import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Command Gateway installer keeps the Mind Vault credential server-side in a limited current-user task', async () => {
  const installer = await readFile(new URL('../scripts/install.ps1', import.meta.url), 'utf8');
  assert.match(installer, /MindVault\\token\.clixml/);
  assert.match(installer, /scripts\[\\\\\/\]\+veridan-command-gateway\\\.mjs/);
  assert.match(installer, /New-ScheduledTaskPrincipal[\s\S]*-LogonType Interactive[\s\S]*-RunLevel Limited/);
  assert.match(installer, /-WindowStyle Hidden/);
  assert.match(installer, /Import-Clixml[\s\S]*VERIDAN_MIND_VAULT_TOKEN/);
  assert.doesNotMatch(installer, /VERIDAN_COMPANION_TOKEN/);
});
