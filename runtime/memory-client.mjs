import { randomUUID } from 'node:crypto';
import { createSignedHeaders } from '../shared/companion-auth.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:57446';

export function createMemoryClient({ baseUrl = DEFAULT_BASE_URL, token, fetchImpl = globalThis.fetch, timeoutMs = 15_000, clock = () => new Date(), nonceFactory = randomUUID } = {}) {
  const origin = validateBaseUrl(baseUrl);
  if (typeof token !== 'string' || token.length < 32) throw new Error('VERIDAN_MIND_VAULT_TOKEN must contain at least 32 characters.');
  async function request(path, authenticated = true) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = { Accept: 'application/json' };
    if (authenticated) Object.assign(headers, createSignedHeaders({ method: 'GET', path, token, timestamp: clock().toISOString(), nonce: nonceFactory() }));
    try {
      const response = await fetchImpl(new URL(path, origin), { method: 'GET', headers, redirect: 'error', signal: controller.signal });
      const text = await response.text(); if (Buffer.byteLength(text) > 1024 * 1024) throw coded('response_too_large');
      let body; try { body = JSON.parse(text); } catch { throw coded('invalid_json'); }
      if (!response.ok) throw coded(body?.error ?? 'http_error'); return body;
    } catch (error) { if (error.code) throw error; if (error?.name === 'AbortError') throw coded('timeout'); throw coded('connection_failed'); } finally { clearTimeout(timer); }
  }
  return Object.freeze({ health: () => request('/health', false), status: () => request('/mind-vault/status'), search: (query) => request(`/mind-vault/search?q=${encodeURIComponent(query)}`) });
}
export function createMemoryClientFromEnv(env = process.env, options = {}) { return createMemoryClient({ ...options, baseUrl: env.VERIDAN_MIND_VAULT_URL ?? DEFAULT_BASE_URL, token: env.VERIDAN_MIND_VAULT_TOKEN }); }
function validateBaseUrl(value) { const url = new URL(value); if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) throw new Error('Mind Vault URL must be an uncredentialed http://127.0.0.1 origin.'); return url; }
function coded(code) { const error = new Error(`Mind Vault request failed: ${code}`); error.code = code; return error; }
