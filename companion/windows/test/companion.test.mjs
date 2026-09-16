import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadConfig } from '../src/config.mjs';
import { Heartbeat } from '../src/heartbeat.mjs';
import { createCompanionServer } from '../src/server.mjs';
import { createState } from '../src/state.mjs';
import { meanAbsoluteDifference } from '../src/watch-monitor.mjs';

const TOKEN = 't'.repeat(48);

test('configuration is loopback-only and requires a strong token', () => {
  assert.throws(() => loadConfig({ VERIDAN_COMPANION_TOKEN: 'short' }), /at least 32/);
  const config = loadConfig({ VERIDAN_COMPANION_TOKEN: TOKEN, VERIDAN_COMPANION_PORT: '0' });
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 0);
});

test('heartbeat retains one timer and stops cleanly', async () => {
  let beats = 0;
  const heartbeat = new Heartbeat({ intervalMs: 10, onBeat: () => { beats += 1; } });
  heartbeat.start();
  heartbeat.start();
  await new Promise((resolve) => setTimeout(resolve, 35));
  heartbeat.stop();
  const stoppedAt = beats;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(heartbeat.running, false);
  assert.equal(beats, stoppedAt);
  assert.ok(beats >= 2);
});

test('screen difference is calculated locally', () => {
  assert.equal(meanAbsoluteDifference([0, 10, 20], [0, 20, 40]), 10);
  assert.throws(() => meanAbsoluteDifference([], []), /non-empty/);
});

test('reinstall lifecycle is safe and background startup remains hidden', async () => {
  const [installer, visibility] = await Promise.all([
    readFile(new URL('../scripts/install.ps1', import.meta.url), 'utf8'),
    readFile(new URL('../src/visibility.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(installer, /Stop-ScheduledTask[\s\S]*Get-NetTCPConnection/);
  assert.match(installer, /Get-CimInstance[\s\S]*expectedCommandPattern = .*main\\\.mjs/);
  assert.match(installer, /process\.Name[\s\S]*node\.exe/);
  assert.match(installer, /Stop-Process[\s\S]*Export-Clixml/);
  assert.match(installer, /-WindowStyle Hidden/);
  assert.match(visibility, /tray\.ps1[\s\S]*windowsHide: true/);
  assert.doesNotMatch(visibility, /watch-indicator\.ps1[\s\S]*windowsHide: true/);
});

test('server exposes minimal health and protects sensor routes', async (context) => {
  const config = loadConfig({ VERIDAN_COMPANION_TOKEN: TOKEN, VERIDAN_COMPANION_PORT: '0' });
  const state = createState();
  let indicatorVisible = false;
  const sensors = {
    activeWindow: async () => ({ title: 'Test', processName: 'node', processId: 1 }),
    see: async () => ({ mimeType: 'image/png', data: 'AA==', ephemeral: true }),
  };
  const watch = {
    active: false,
    async start() { this.active = true; },
    stop() { this.active = false; },
  };
  const visibility = {
    async showWatchIndicator() { indicatorVisible = true; return true; },
    hideWatchIndicator() { indicatorVisible = false; },
  };
  const server = createCompanionServer({ config, state, sensors, watch, visibility });
  const address = await server.listen();
  context.after(() => server.close());
  const origin = `http://${address.address}:${address.port}`;

  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).component, 'veridan-windows-companion');

  const denied = await fetch(`${origin}/capabilities`);
  assert.equal(denied.status, 401);

  const authorized = { Authorization: `Bearer ${TOKEN}` };
  const capabilities = await fetch(`${origin}/capabilities`, { headers: authorized });
  assert.equal(capabilities.status, 200);
  assert.equal((await capabilities.json()).execution, false);

  const browserRequest = await fetch(`${origin}/capabilities`, { headers: { ...authorized, Origin: 'https://example.com' } });
  assert.equal(browserRequest.status, 403);

  const see = await fetch(`${origin}/v1/see`, { method: 'POST', headers: authorized });
  const observation = await see.json();
  assert.equal(observation.capability, 'screen_see');
  assert.equal(observation.retention, 'ephemeral');

  const started = await fetch(`${origin}/v1/watch/start`, { method: 'POST', headers: authorized });
  assert.equal(started.status, 200);
  assert.equal(indicatorVisible, true);

  const stopped = await fetch(`${origin}/v1/watch/stop`, { method: 'POST', headers: authorized });
  assert.equal(stopped.status, 200);
  assert.equal(indicatorVisible, false);
});

test('WATCH fails closed when its visible indicator cannot start', async (context) => {
  const config = loadConfig({ VERIDAN_COMPANION_TOKEN: TOKEN, VERIDAN_COMPANION_PORT: '0' });
  const state = createState();
  const server = createCompanionServer({
    config,
    state,
    sensors: {},
    watch: { active: false, async start() {}, stop() {} },
    visibility: { showWatchIndicator: async () => false, hideWatchIndicator() {} },
  });
  const address = await server.listen();
  context.after(() => server.close());
  const response = await fetch(`http://${address.address}:${address.port}/v1/watch/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert.equal(response.status, 500);
  assert.match((await response.json()).message, /Visible WATCH indicator/);
  assert.equal(state.snapshot().watch.active, false);
});
