import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createCommandGatewayServer } from '../runtime/command-gateway.mjs';
import { createMemoryClient } from '../runtime/memory-client.mjs';
import { createOrchestrator } from '../runtime/orchestrator.mjs';
import { createMindVaultServer } from '../mind-vault/server.mjs';

const TOKEN = 'command-gateway-memory-token-'.repeat(2);

test('Command Desk routes same-origin vault questions through Core and returns source citations', async (context) => {
  const fixture = await startFixture(context);
  const health = await fetch(`${fixture.baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal(JSON.stringify(await health.json()).match(/token|secret/i), null);

  const response = await post(fixture.baseUrl, { command: 'Veridan, what did we decide about zero cross?' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'completed');
  assert.equal(body.capabilityId, 'memory.search');
  assert.deepEqual(body.verification, ['sources_returned', 'source_paths_scoped', 'read_only_asserted']);
  assert.equal(body.sources[0].path, '03 Trading/Zero Cross.md');
  assert.equal(JSON.stringify(body).includes(TOKEN), false);
  assert.equal(JSON.stringify(fixture.core.events.history()).includes('TP ladder'), false);
});

test('Command Desk rejects cross-origin, malformed, and non-memory capability requests', async (context) => {
  const fixture = await startFixture(context);
  const noOrigin = await fetch(`${fixture.baseUrl}/v1/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: 'search vault zero cross' }) });
  assert.equal(noOrigin.status, 403);
  assert.equal((await noOrigin.json()).error, 'browser_origin_rejected');

  const wrongOrigin = await fetch(`${fixture.baseUrl}/v1/commands`, { method: 'POST', headers: { Origin: 'http://example.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ command: 'search vault zero cross' }) });
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await wrongOrigin.json()).error, 'browser_origin_rejected');

  const malformed = await post(fixture.baseUrl, { command: 'search vault zero cross', mode: 'execute' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, 'invalid_command');

  const denied = await post(fixture.baseUrl, { command: 'check production' });
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { status: 'denied', reason: 'capability_not_exposed', intent: 'SYSTEM_DIAGNOSTIC', capabilityId: 'system.inspect' });
});

test('Command Desk does not make unsupported request methods or remote assets available', async (context) => {
  const fixture = await startFixture(context);
  const page = await fetch(`${fixture.baseUrl}/`);
  assert.equal(page.status, 200);
  const source = await page.text();
  assert.equal(source.includes('http://'), false);
  assert.equal(source.includes('https://'), false);
  const method = await fetch(`${fixture.baseUrl}/v1/commands`, { headers: { Origin: fixture.baseUrl } });
  assert.equal(method.status, 405);
  assert.equal((await method.json()).error, 'method_not_allowed');
});

async function post(baseUrl, payload) {
  return fetch(`${baseUrl}/v1/commands`, { method: 'POST', headers: { Origin: baseUrl, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

async function startFixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'veridan-command-desk-'));
  await mkdir(join(root, '03 Trading'), { recursive: true });
  await writeFile(join(root, '03 Trading', 'Zero Cross.md'), '# Zero Cross\nThe zero cross resets the TP ladder and is the only reset trigger.');
  const mindVault = createMindVaultServer({ config: { host: '127.0.0.1', port: 0, token: TOKEN, root, signatureWindowMs: 30_000 } });
  const mindAddress = await mindVault.listen();
  const memoryClient = createMemoryClient({ baseUrl: `http://${mindAddress.address}:${mindAddress.port}`, token: TOKEN });
  const core = await createOrchestrator({ memoryClient });
  const gateway = createCommandGatewayServer({ config: { host: '127.0.0.1', port: 0 }, orchestrator: core, idFactory: () => 'gateway-request-id' });
  const address = await gateway.listen();
  context.after(async () => { await gateway.close(); await mindVault.close(); });
  return { baseUrl: `http://${address.address}:${address.port}`, core };
}
