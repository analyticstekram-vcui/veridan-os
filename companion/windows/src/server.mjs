import { createServer } from 'node:http';
import { createRequestAuthenticator } from '../../../shared/companion-auth.mjs';
import { observationEnvelope } from './envelope.mjs';

const CAPABILITIES = Object.freeze([
  'health',
  'capabilities',
  'last_error',
  'active_window',
  'screen_see',
  'screen_watch',
]);

export function createCompanionServer({ config, state, sensors, watch, visibility, clock = () => new Date() }) {
  const authenticate = createRequestAuthenticator({
    token: config.token,
    now: () => clock().getTime(),
    windowMs: config.signatureWindowMs,
  });
  const server = createServer(async (request, response) => {
    setSecurityHeaders(response);

    try {
      if (request.headers.origin) return json(response, 403, { error: 'browser_origin_rejected' });
      const url = new URL(request.url ?? '/', `http://${config.host}`);

      if (request.method === 'GET' && url.pathname === '/health') {
        const snapshot = state.snapshot();
        const now = clock();
        const heartbeatAgeMs = Math.max(0, now.getTime() - Date.parse(snapshot.lastHeartbeatAt));
        const heartbeatFresh = heartbeatAgeMs <= config.heartbeatIntervalMs * 2;
        return json(response, 200, {
          status: heartbeatFresh ? 'ok' : 'degraded',
          component: 'veridan-windows-companion',
          version: '0.2.0',
          heartbeat: snapshot.lastHeartbeatAt,
          heartbeatAgeMs,
          watchActive: snapshot.watch.active,
          timestamp: now.toISOString(),
        });
      }

      const authorization = authenticate(request, url.pathname);
      if (!authorization.ok) return json(response, 401, { error: 'unauthorized' });

      if (request.method === 'GET' && url.pathname === '/capabilities') {
        return json(response, 200, { capabilities: CAPABILITIES, execution: false });
      }

      if (request.method === 'GET' && url.pathname === '/last-error') {
        return json(response, 200, { lastError: state.snapshot().lastError });
      }

      if (request.method === 'GET' && url.pathname === '/v1/active-window') {
        const payload = await sensors.activeWindow();
        return json(response, 200, observationEnvelope({ capability: 'active_window', payload, clock }));
      }

      if (request.method === 'POST' && url.pathname === '/v1/see') {
        const payload = await sensors.see();
        return json(response, 200, observationEnvelope({ capability: 'screen_see', payload, clock }));
      }

      if (request.method === 'POST' && url.pathname === '/v1/watch/start') {
        if (watch.active) return json(response, 200, { status: 'already_active', watch: state.snapshot().watch });
        const indicatorVisible = await visibility.showWatchIndicator();
        if (!indicatorVisible) throw new Error('Visible WATCH indicator could not be started.');
        state.setWatch({ active: true, visibleIndicator: true, startedAt: clock().toISOString() });
        try {
          await watch.start();
        } catch (error) {
          visibility.hideWatchIndicator();
          state.setWatch({ active: false, visibleIndicator: false });
          throw error;
        }
        return json(response, 200, { status: 'active', watch: state.snapshot().watch });
      }

      if (request.method === 'POST' && url.pathname === '/v1/watch/stop') {
        watch.stop();
        visibility.hideWatchIndicator();
        state.setWatch({ active: false, visibleIndicator: false });
        return json(response, 200, { status: 'stopped', watch: state.snapshot().watch });
      }

      return json(response, 404, { error: 'not_found' });
    } catch (error) {
      state.recordError('http_request', error);
      return json(response, 500, { error: 'companion_error', message: error.message });
    }
  });

  return {
    raw: server,
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, () => {
          server.off('error', reject);
          resolve(server.address());
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

function setSecurityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'none'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

function json(response, status, body) {
  const encoded = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(encoded) });
  response.end(encoded);
}
