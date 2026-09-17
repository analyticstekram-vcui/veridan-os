import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createMemoryClient } from '../runtime/memory-client.mjs';
import { createOrchestrator } from '../runtime/orchestrator.mjs';
import { createMindVaultServer } from '../mind-vault/server.mjs';

const TOKEN = 'memory-integration-token-'.repeat(2);

test('Core retrieves source-cited vault knowledge and events persist source identifiers only', async (context) => {
  const fixture = await startFixture(context);
  const orchestrator = await createOrchestrator({ memoryClient: fixture.client });
  const result = await orchestrator.execute('Veridan, what did we decide about zero cross?', { source: 'test' });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.verified, ['sources_returned', 'source_paths_scoped', 'read_only_asserted']);
  assert.equal(result.result.sources[0].path, '03 Trading/Zero Cross.md');
  assert.equal(result.result.sources[0].title, 'Zero Cross');
  assert.equal(result.result.sources.length, 1);
  const history = orchestrator.events.history();
  assert.equal(history.at(-1).type, 'memory.retrieved');
  assert.equal(JSON.stringify(history).includes('TP ladder'), false);
  assert.equal(history.at(-1).payload.source_count, 1);

  const governance = await fixture.client.search('governance');
  assert.equal(governance.sources[0].title, 'Governance Matrix');
});

test('Mind Vault bridge rejects unsigned and direct arbitrary-path requests', async (context) => {
  const fixture = await startFixture(context);
  const base = fixture.baseUrl;
  const unsigned = await fetch(`${base}/mind-vault/search?q=zero`);
  assert.equal(unsigned.status, 401);
  const arbitrary = await fetch(`${base}/mind-vault/note?path=../../secret`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(arbitrary.status, 401);
});

test('Core fails closed when an authenticated bridge returns no sources', async () => {
  const orchestrator = await createOrchestrator({ memoryClient: { search: async () => ({ envelopeVersion: '1.0', source: 'obsidian-mind-vault', capability: 'memory_search', readOnly: true, writesEnabled: false, sources: [] }) } });
  const result = await orchestrator.execute('search vault missing subject', { source: 'test' });
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'memory_verification_failed');
});

async function startFixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'veridan-vault-'));
  await mkdir(join(root, '03 Trading'), { recursive: true });
  await mkdir(join(root, '04 Governance'), { recursive: true });
  await writeFile(join(root, '03 Trading', 'Zero Cross.md'), '# Zero Cross\nThe zero cross resets the TP ladder and is the only reset trigger.');
  await writeFile(join(root, '04 Governance', 'Governance Matrix.md'), '# Purpose\nZero tolerance governance policy, cross-functional approval, and control requirements.');
  const server = createMindVaultServer({ config: { host: '127.0.0.1', port: 0, token: TOKEN, root, signatureWindowMs: 30_000 } });
  const address = await server.listen();
  context.after(() => server.close());
  const baseUrl = `http://${address.address}:${address.port}`;
  return { baseUrl, client: createMemoryClient({ baseUrl, token: TOKEN }) };
}
