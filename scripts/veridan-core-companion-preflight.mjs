#!/usr/bin/env node
import { createCompanionClientFromEnv } from '../runtime/companion-client.mjs';
import { createOrchestrator } from '../runtime/orchestrator.mjs';

const client = createCompanionClientFromEnv();
const orchestrator = await createOrchestrator({ companionClient: client });
let watchAttempted = false;

try {
  const health = await client.health();
  check(health.status === 'ok', 'health');
  check(health.watchActive === false, 'watch_initially_stopped');

  const capabilities = await client.capabilities();
  check(capabilities.execution === false, 'capabilities_nonexecuting');

  const see = await orchestrator.execute('Veridan, see my screen', { source: 'core-preflight' });
  check(see.status === 'completed', 'core_screen_see');
  check(see.verified.includes('fresh_frame'), 'see_fresh_frame');
  check(!JSON.stringify(orchestrator.events.history()).includes(see.result.payload.data), 'frame_not_persisted');

  watchAttempted = true;
  const watch = await orchestrator.execute('Veridan, watch this', {
    source: 'core-preflight',
    userDirected: true,
  });
  check(watch.status === 'completed', 'core_screen_watch_prepare');
  check(watch.result.watch.visibleIndicator === true, 'watch_visible');

  console.log('Veridan Core + Windows Companion preflight passed.');
} finally {
  if (watchAttempted) await client.stopWatch();
}

function check(condition, name) {
  if (!condition) throw new Error(`Preflight failed: ${name}`);
  console.log(`[PASS] ${name}`);
}
