import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Mind Vault installer uses a limited current-user task and refuses unexpected listeners', async () => {
  const installer = await readFile(new URL('../scripts/install.ps1', import.meta.url), 'utf8');
  assert.match(installer, /Get-NetTCPConnection[\s\S]*expectedCommandPattern/);
  assert.match(installer, /scripts\[\\\\\/\]\+mind-vault-bridge-server\\\.mjs/);
  assert.match(installer, /New-ScheduledTaskPrincipal[\s\S]*-LogonType Interactive[\s\S]*-RunLevel Limited/);
  assert.match(installer, /-WindowStyle Hidden/);
  assert.match(installer, /Import-Clixml[\s\S]*VERIDAN_MIND_VAULT_TOKEN/);
});
