const baseUrl = process.env.VERIDAN_COMMAND_GATEWAY_URL ?? 'http://127.0.0.1:4700';
const base = new URL(baseUrl);
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.port !== '4700' || base.pathname !== '/' || base.search || base.hash) throw new Error('VERIDAN_COMMAND_GATEWAY_URL must be http://127.0.0.1:4700.');
const health = await fetch(new URL('/health', base));
const healthBody = await health.json();
if (!health.ok || healthBody.status !== 'ok' || healthBody.component !== 'veridan-command-gateway' || JSON.stringify(healthBody).match(/token|secret/i)) throw new Error('Command Gateway health verification failed.');
console.log('[PASS] command_gateway_health');
const valid = await command('Veridan, search vault for Veridan');
if (!valid.response.ok || valid.body.status !== 'completed' || valid.body.capabilityId !== 'memory.search' || !Array.isArray(valid.body.sources) || valid.body.sources.length < 1 || !Array.isArray(valid.body.verification)) throw new Error('Source-backed command verification failed.');
console.log('[PASS] command_memory_search');
if (JSON.stringify(valid.body).match(/VERIDAN_MIND_VAULT_TOKEN|Authorization|X-Veridan-Signature/i)) throw new Error('Credential material appeared in gateway output.');
console.log('[PASS] command_credentials_not_exposed');
const denied = await command('check production');
if (denied.response.status !== 403 || denied.body.reason !== 'capability_not_exposed') throw new Error('Non-memory command was exposed through the local gateway.');
console.log('[PASS] command_non_memory_denied');
console.log('Veridan Command Gateway preflight passed.');

async function command(text) {
  const response = await fetch(new URL('/v1/commands', base), { method: 'POST', headers: { Origin: base.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ command: text }) });
  return { response, body: await response.json() };
}
