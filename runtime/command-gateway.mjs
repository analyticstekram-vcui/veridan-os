import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const MAX_COMMAND_BYTES = 1024;
const EXPOSED_CAPABILITIES = new Set(['memory.search']);

export function loadCommandGatewayConfig(env = process.env) {
  const port = Number(env.VERIDAN_COMMAND_GATEWAY_PORT ?? 4700);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('VERIDAN_COMMAND_GATEWAY_PORT must be an integer between 0 and 65535.');
  return Object.freeze({ host: '127.0.0.1', port });
}

export function createCommandGatewayServer({ config, orchestrator, idFactory = randomUUID }) {
  if (!orchestrator?.execute || !orchestrator?.route) throw new Error('Command Gateway requires a Veridan Core orchestrator.');
  let boundPort = config.port;
  const server = createServer(async (request, response) => {
    securityHeaders(response);
    const pathname = new URL(request.url ?? '/', `http://${config.host}`).pathname;
    try {
      if (!isExpectedHost(request, config.host, boundPort)) return json(response, 421, { error: 'misdirected_request' });
      if (request.method === 'GET' && pathname === '/health') return json(response, 200, { status: 'ok', component: 'veridan-command-gateway', version: '0.1.0', mode: 'READ_ONLY' });
      if (request.method === 'GET' && pathname === '/') return html(response, 200, commandDesk());
      if (pathname !== '/v1/commands') return json(response, 404, { error: 'not_found' });
      if (request.method !== 'POST') return json(response, 405, { error: 'method_not_allowed' });
      if (!isSameOrigin(request, config.host, boundPort)) return json(response, 403, { error: 'browser_origin_rejected' });

      const payload = await readJson(request);
      const command = validatePayload(payload);
      const proposed = orchestrator.route(command, { source: 'veridan-command-desk', userDirected: true });
      if (proposed.status !== 'routed') return json(response, 403, safeFailure(proposed));
      if (!EXPOSED_CAPABILITIES.has(proposed.capability.id)) {
        return json(response, 403, { status: 'denied', reason: 'capability_not_exposed', intent: proposed.intent, capabilityId: proposed.capability.id });
      }

      const result = await orchestrator.execute(command, { source: 'veridan-command-desk', userDirected: true });
      if (result.status !== 'completed') return json(response, 502, safeFailure(result));
      return json(response, 200, safeSuccess(result, idFactory));
    } catch (error) {
      const status = error.code === 'invalid_command' || error.code === 'invalid_json' || error.code === 'body_too_large' ? 400 : 500;
      return json(response, status, { error: error.code ?? 'command_gateway_error' });
    }
  });

  return {
    raw: server,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, () => {
        server.off('error', reject);
        const address = server.address();
        boundPort = address.port;
        resolve(address);
      });
    }),
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function safeSuccess(result, idFactory) {
  const sources = result.result.sources.map(({ sourceId, path, title, excerpt, updatedAt }) => ({ sourceId, path, title, excerpt, updatedAt }));
  return {
    status: 'completed',
    commandId: result.commandId,
    correlationId: result.correlationId,
    requestId: idFactory(),
    intent: result.intent,
    capabilityId: result.capability.id,
    verification: result.verified,
    sources,
  };
}

function safeFailure(result) {
  return {
    status: result.status === 'approval_required' ? 'approval_required' : 'denied',
    reason: result.reason ?? result.policy?.reason ?? 'command_denied',
    ...(result.intent ? { intent: result.intent } : {}),
    ...(result.capability?.id ? { capabilityId: result.capability.id } : {}),
  };
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_COMMAND_BYTES) throw coded('body_too_large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw coded('invalid_json'); }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length !== 1 || typeof payload.command !== 'string') throw coded('invalid_command');
  const command = payload.command.trim().replace(/\s+/g, ' ');
  if (command.length < 2 || command.length > 512) throw coded('invalid_command');
  return command;
}

function isExpectedHost(request, host, port) {
  return request.headers.host === `${host}:${port}`;
}

function isSameOrigin(request, host, port) {
  const origin = request.headers.origin;
  const fetchSite = request.headers['sec-fetch-site'];
  return origin === `http://${host}:${port}` && (fetchSite === undefined || fetchSite === 'same-origin');
}

function securityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}

function json(response, status, body) {
  const encoded = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(encoded) });
  response.end(encoded);
}

function html(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  response.end(body);
}

function coded(code) { const error = new Error(code); error.code = code; return error; }

function commandDesk() {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veridan Command Desk</title><style>body{margin:0;background:#08110d;color:#eff9f1;font:16px system-ui,sans-serif}.shell{max-width:800px;margin:6vh auto;padding:32px;background:#102219;border:1px solid #2b6547;border-radius:16px}h1{margin:0 0 8px}p{color:#b5cabb;line-height:1.5}textarea{box-sizing:border-box;width:100%;min-height:110px;padding:12px;background:#07100b;color:#fff;border:1px solid #4d8b63;border-radius:8px;font:inherit}button{margin-top:12px;padding:10px 16px;border:0;border-radius:8px;background:#83d698;color:#082010;font-weight:700;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#07100b;border-radius:8px;min-height:4em}.muted{font-size:.9em;color:#9eb2a4}</style><main class="shell"><h1>Veridan Command Desk</h1><p>Read-only, source-backed Mind Vault search. Screen access, automation, trading, and write actions are not exposed here.</p><textarea id="command" aria-label="Veridan command" placeholder="What did we decide about zero cross?"></textarea><button id="send">Search Mind Vault</button><pre id="result" aria-live="polite">Ready.</pre><p class="muted">This desk is available only on this Windows computer at 127.0.0.1.</p></main><script>const q=(s)=>document.querySelector(s);q('#send').addEventListener('click',async()=>{const output=q('#result'),command=q('#command').value.trim();output.textContent='Searching…';try{const response=await fetch('/v1/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command})});const data=await response.json();output.textContent=JSON.stringify(data,null,2)}catch{output.textContent='The local Command Gateway is unavailable.'}})</script></html>`;
}
