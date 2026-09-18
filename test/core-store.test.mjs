import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createCoreStore, defaultAuditPath } from '../runtime/core-store.mjs';
import { EventBus } from '../runtime/event-bus.mjs';
import { loadContracts } from '../runtime/contracts.mjs';
import { createOrchestrator } from '../runtime/orchestrator.mjs';

const contracts = await loadContracts();

test('appends allowlisted events and replays them without notifying subscribers', async () => {
  const path = await auditPath();
  const first = new EventBus(contracts.events, { store: createCoreStore({ path }) });
  const firstEvent = first.publish('command.received', { command_id: 'cmd-1', source: 'test', command: 'secret command' }, { token: 'secret-token' });
  first.publish('policy.evaluated', { command_id: 'cmd-1', decision: 'allow', risk_level: 0, unrecognized: 'discard' });

  const lines = (await readFile(path, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(lines.length, 2);
  assert.deepEqual(Object.keys(lines[0]), ['record_type', 'event_id', 'type', 'occurred_at', 'payload']);
  assert.deepEqual(lines[0].payload, { command_id: 'cmd-1', source: 'test' });
  assert.equal(JSON.stringify(lines).includes('secret'), false);

  let notified = false;
  const second = new EventBus(contracts.events, { store: createCoreStore({ path }), initialEvents: createCoreStore({ path }).replay() });
  second.subscribe('command.received', () => { notified = true; });
  assert.deepEqual(second.history().map(({ event_id }) => event_id), [firstEvent.event_id, lines[1].event_id]);
  assert.equal(notified, false);
});

test('uses the configured audit path and platform app-data fallback', () => {
  assert.equal(defaultAuditPath({ VERIDAN_CORE_AUDIT_PATH: 'C:\\temp\\audit.jsonl' }, 'win32'), 'C:\\temp\\audit.jsonl');
  assert.equal(defaultAuditPath({ LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' }, 'win32'), 'C:\\Users\\tester\\AppData\\Local\\Veridan\\Core\\audit.jsonl');
  assert.equal(defaultAuditPath({ XDG_STATE_HOME: '/tmp/state' }, 'linux'), '/tmp/state/Veridan/Core/audit.jsonl');
});

test('preserves ordering and handles duplicate event IDs deterministically', async () => {
  const path = await auditPath();
  const store = createCoreStore({ path });
  const first = new EventBus(contracts.events, { store });
  const event = first.publish('command.received', { command_id: 'cmd-1', source: 'test' });
  const duplicate = { record_type: 'event', event_id: event.event_id, type: 'route.denied', occurred_at: event.occurred_at, payload: { command_id: 'cmd-1', reason: 'wrong' } };
  await writeFile(path, `${JSON.stringify(duplicate)}\n`, { flag: 'a' });

  const replayed = store.replay();
  assert.equal(replayed.length, 1);
  assert.equal(replayed[0].type, 'command.received');
});

test('skips malformed and truncated JSONL records without adding them to history', async () => {
  const path = await auditPath();
  const store = createCoreStore({ path });
  const bus = new EventBus(contracts.events, { store });
  const event = bus.publish('command.received', { command_id: 'cmd-1', source: 'test' });
  await writeFile(path, `${JSON.stringify({ record_type: 'event', event_id: 'later', type: 'route.denied', occurred_at: event.occurred_at, payload: { command_id: 'cmd-1', reason: 'later' } })}\n{"record_type":"event","event_id":"truncated"`, { flag: 'a' });

  const replayed = store.replay();
  assert.deepEqual(replayed.map(({ event_id }) => event_id), [event.event_id, 'later']);
  assert.equal(replayed.some(({ event_id }) => event_id === 'truncated'), false);
});

test('persists only safe memory and companion projections', async () => {
  const path = await auditPath();
  const bus = new EventBus(contracts.events, { store: createCoreStore({ path }) });
  bus.publish('memory.retrieved', {
    command_id: 'cmd-1',
    correlation_id: 'corr-1',
    capability_id: 'memory.search',
    source_ids: ['0123456789abcdef0123'],
    source_count: 1,
    excerpt: 'private note body',
    source_body: 'private note body',
    raw_response: { token: 'secret-token' },
  });
  bus.publish('action.verified', {
    command_id: 'cmd-1',
    correlation_id: 'corr-1',
    capability_id: 'screen.see',
    checks: ['fresh_frame', 'retention_ephemeral', 'source_identified'],
    frame_bytes: 'AA==',
    credentials: 'secret-credential',
  }, { dpapi: 'protected-value' });
  bus.publish('observation.received', {
    command_id: 'cmd-1',
    correlation_id: 'corr-1',
    capability_id: 'screen.see',
    observation_id: 'observation-1',
    source: 'windows-companion',
    payload: { data: 'AA==' },
    local_path: 'C:\\Users\\peter\\secret.png',
  });

  const contents = await readFile(path, 'utf8');
  assert.equal(contents.includes('private note body'), false);
  assert.equal(contents.includes('secret-token'), false);
  assert.equal(contents.includes('secret-credential'), false);
  assert.equal(contents.includes('protected-value'), false);
  assert.equal(contents.includes('AA=='), false);
  assert.equal(contents.includes('secret.png'), false);

  const records = contents.trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(records[0].payload, {
    command_id: 'cmd-1',
    correlation_id: 'corr-1',
    capability_id: 'memory.search',
    source_ids: ['0123456789abcdef0123'],
    source_count: 1,
  });
  assert.deepEqual(records[1].payload, {
    command_id: 'cmd-1',
    correlation_id: 'corr-1',
    capability_id: 'screen.see',
    checks: ['fresh_frame', 'retention_ephemeral', 'source_identified'],
  });
  assert.deepEqual(records[2].payload, {
    command_id: 'cmd-1',
    correlation_id: 'corr-1',
    capability_id: 'screen.see',
    observation_id: 'observation-1',
    source: 'windows-companion',
  });
});

test('rejects unknown events and fails closed when persistence fails', async () => {
  const path = await auditPath();
  const bus = new EventBus(contracts.events, { store: createCoreStore({ path }) });
  assert.throws(() => bus.publish('unknown.event', {}), /Unregistered event type/);
  assert.throws(() => bus.publish('memory.note.created', { source: 'obsidian', path: '01 System Map/secret.md' }), /Event persistence rejected/);
  assert.throws(() => bus.publish('command.received', { command_id: 'cmd-1', source: 'C:/Users/tester' }), /Event persistence rejected/);

  const failing = new EventBus(contracts.events, { store: { append() { throw new Error('disk unavailable'); } } });
  assert.throws(() => failing.publish('command.received', { command_id: 'cmd-1', source: 'test' }), /disk unavailable/);
  assert.deepEqual(failing.history(), []);
});

test('retains existing in-memory behavior when no store is supplied', () => {
  const bus = new EventBus(contracts.events);
  bus.publish('command.received', { command_id: 'cmd-1', source: 'test', command: 'raw command text' }, { token: 'in-memory-only' });
  assert.equal(bus.history()[0].payload.command, 'raw command text');
  assert.equal(bus.history()[0].metadata.token, 'in-memory-only');
});

test('orchestrator rehydrates durable event history without replay notifications', async () => {
  const path = await auditPath();
  const first = await createOrchestrator({ eventStore: createCoreStore({ path }), idFactory: () => 'cmd-1' });
  first.route('flibbertigibbet', { source: 'test' });

  const second = await createOrchestrator({ eventStore: createCoreStore({ path }), idFactory: () => 'cmd-2' });
  assert.deepEqual(second.events.history().map(({ type, event_id }) => ({ type, event_id })), [
    { type: 'command.received', event_id: first.events.history()[0].event_id },
    { type: 'route.denied', event_id: first.events.history()[1].event_id },
  ]);
});

async function auditPath() {
  const root = await mkdtemp(join(tmpdir(), 'veridan-core-store-'));
  return join(root, 'audit.jsonl');
}
