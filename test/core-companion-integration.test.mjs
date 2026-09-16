import assert from 'node:assert/strict';
import test from 'node:test';
import { createCompanionServer } from '../companion/windows/src/server.mjs';
import { loadConfig } from '../companion/windows/src/config.mjs';
import { createState } from '../companion/windows/src/state.mjs';
import { createCompanionClient } from '../runtime/companion-client.mjs';
import { createCompanionDispatcher } from '../runtime/companion-dispatcher.mjs';
import { createOrchestrator } from '../runtime/orchestrator.mjs';

const TOKEN = 'integration-token-'.repeat(3);

test('Companion client accepts only a strong token and exact loopback HTTP origin', () => {
  assert.throws(() => createCompanionClient({ baseUrl: 'http://localhost:4701', token: TOKEN }), /127\.0\.0\.1/);
  assert.throws(() => createCompanionClient({ baseUrl: 'https://127.0.0.1:4701', token: TOKEN }), /127\.0\.0\.1/);
  assert.throws(() => createCompanionClient({ token: 'short' }), /at least 32/);
});

test('Core executes SEE through the signed client and never persists frame bytes in events', async (context) => {
  const fixture = await startFixture(context);
  const orchestrator = await createOrchestrator({ companionClient: fixture.client });
  const result = await orchestrator.execute('Veridan, see my screen', { source: 'test' });

  assert.equal(result.status, 'completed');
  assert.deepEqual(result.verified, ['fresh_frame', 'retention_ephemeral', 'source_identified']);
  assert.equal(result.result.payload.data, 'AA==');

  const history = orchestrator.events.history();
  assert.deepEqual(history.map(({ type }) => type), [
    'command.received',
    'route.resolved',
    'policy.evaluated',
    'action.proposed',
    'action.verified',
    'observation.received',
  ]);
  assert.equal(JSON.stringify(history).includes('AA=='), false);
  assert.equal(history.at(-1).payload.source, 'windows-companion');
});

test('Core requires direct user direction before starting visible WATCH', async (context) => {
  const fixture = await startFixture(context);
  const orchestrator = await createOrchestrator({ companionClient: fixture.client });

  const gated = await orchestrator.execute('Veridan, watch this', { source: 'test' });
  assert.equal(gated.status, 'approval_required');
  assert.equal(gated.policy.reason, 'user_direction_required');
  assert.equal(fixture.watch.active, false);

  const started = await orchestrator.execute('Veridan, watch this', { source: 'test', userDirected: true });
  assert.equal(started.status, 'completed');
  assert.equal(started.result.watch.visibleIndicator, true);
  assert.equal(fixture.watch.active, true);
  await fixture.client.stopWatch();
  assert.equal(fixture.watch.active, false);
});

test('Core fails closed when the Companion returns a forged SEE observation', async () => {
  const dispatcher = createCompanionDispatcher({
    see: async () => ({
      envelopeVersion: '1.0',
      observationId: 'forged-observation',
      source: 'unknown-sensor',
      capability: 'screen_see',
      observedAt: new Date().toISOString(),
      retention: 'ephemeral',
      payload: { mimeType: 'image/png', data: 'AA==', ephemeral: true },
    }),
  });

  await assert.rejects(() => dispatcher.execute('screen.see'), { code: 'observation_verification_failed' });
});

test('Core never forwards a routed non-Companion capability to the sensory client', async () => {
  let called = false;
  const orchestrator = await createOrchestrator({
    companionClient: new Proxy({}, {
      get() {
        called = true;
        throw new Error('Sensory client must not be called.');
      },
    }),
  });
  const result = await orchestrator.execute('Veridan, check production', { source: 'test' });
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'capability_not_dispatchable');
  assert.equal(called, false);
});

async function startFixture(context) {
  const config = loadConfig({ VERIDAN_COMPANION_TOKEN: TOKEN, VERIDAN_COMPANION_PORT: '0' });
  const state = createState();
  let indicatorVisible = false;
  const watch = {
    active: false,
    async start() { this.active = true; },
    stop() { this.active = false; },
  };
  const server = createCompanionServer({
    config,
    state,
    sensors: {
      activeWindow: async () => ({ title: 'Test', processName: 'node', processId: 1 }),
      see: async () => ({ mimeType: 'image/png', data: 'AA==', ephemeral: true }),
    },
    watch,
    visibility: {
      async showWatchIndicator() { indicatorVisible = true; return true; },
      hideWatchIndicator() { indicatorVisible = false; },
    },
  });
  const address = await server.listen();
  context.after(() => server.close());
  return {
    watch,
    get indicatorVisible() { return indicatorVisible; },
    client: createCompanionClient({ baseUrl: `http://${address.address}:${address.port}`, token: TOKEN }),
  };
}
