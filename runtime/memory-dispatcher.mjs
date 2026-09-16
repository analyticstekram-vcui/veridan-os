const ALLOWED_ROOTS = ['00 Dashboard', '01 System Map', '02 Veridan Operator', '03 Trading', '04 Governance', '05 SOPs', '06 Trust', '07 LLCs', 'Captures', 'Research', 'Trading', 'Veridan', 'Businesses'];
export function createMemoryDispatcher(client) {
  if (!client) throw new Error('Mind Vault client is not configured.');
  return Object.freeze({ async execute(capabilityId, command, context = {}) { if (capabilityId !== 'memory.search') throw coded('capability_not_dispatchable'); const query = extractQuery(context.memoryQuery ?? command); const result = await client.search(query); return verify(result); } });
}
function verify(result) {
  const sources = result?.sources;
  const valid = result?.envelopeVersion === '1.0' && result?.source === 'obsidian-mind-vault' && result?.capability === 'memory_search' && result?.readOnly === true && result?.writesEnabled === false && Array.isArray(sources) && sources.length > 0 && sources.length <= 5 && sources.every((item) => typeof item.sourceId === 'string' && /^[a-f0-9]{20}$/.test(item.sourceId) && typeof item.path === 'string' && isScoped(item.path) && typeof item.title === 'string' && typeof item.excerpt === 'string' && item.excerpt.length <= 500);
  if (!valid) throw coded('memory_verification_failed');
  return Object.freeze({ result, checks: Object.freeze(['sources_returned', 'source_paths_scoped', 'read_only_asserted']), sourceIds: Object.freeze(sources.map(({ sourceId }) => sourceId)) });
}
function extractQuery(command) { const result = String(command ?? '').replace(/^(veridan[,\s]*)?/i, '').replace(/^(what did we decide about|search (the )?vault for|find (a )?note (about )?|remember when|mind vault)\s*/i, '').trim(); if (result.length < 2) throw coded('invalid_query'); return result; }
function isScoped(path) { return !path.startsWith('/') && !path.includes('..') && ALLOWED_ROOTS.some((root) => path === root || path.startsWith(`${root}/`)); }
function coded(code) { const error = new Error(`Mind Vault dispatch failed: ${code}`); error.code = code; return error; }
