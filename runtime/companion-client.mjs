import { randomUUID } from 'node:crypto';
import { createSignedHeaders } from '../shared/companion-auth.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4701';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;

export class CompanionRequestError extends Error {
  constructor(code, { status = null, path = null } = {}) {
    super(`Windows Companion request failed: ${code}`);
    this.name = 'CompanionRequestError';
    this.code = code;
    this.status = status;
    this.path = path;
  }
}

export function createCompanionClient({
  baseUrl = DEFAULT_BASE_URL,
  token,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  clock = () => new Date(),
  nonceFactory = randomUUID,
} = {}) {
  const origin = validateBaseUrl(baseUrl);
  if (typeof token !== 'string' || token.length < 32) throw new Error('VERIDAN_COMPANION_TOKEN must contain at least 32 characters.');
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new Error('Companion timeout must be between 1 and 60000 milliseconds.');

  async function request(method, path, { authenticated = true } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = { Accept: 'application/json' };
    if (authenticated) {
      Object.assign(headers, createSignedHeaders({
        method,
        path,
        token,
        timestamp: clock().toISOString(),
        nonce: nonceFactory(),
      }));
    }

    try {
      const response = await fetchImpl(new URL(path, origin), {
        method,
        headers,
        redirect: 'error',
        signal: controller.signal,
      });
      const declaredSize = Number(response.headers.get('content-length') ?? 0);
      if (declaredSize > MAX_RESPONSE_BYTES) throw new CompanionRequestError('response_too_large', { path });
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw new CompanionRequestError('response_too_large', { path });
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new CompanionRequestError('invalid_json', { status: response.status, path });
      }
      if (!response.ok) throw new CompanionRequestError(body?.error ?? 'http_error', { status: response.status, path });
      return body;
    } catch (error) {
      if (error instanceof CompanionRequestError) throw error;
      if (error?.name === 'AbortError') throw new CompanionRequestError('timeout', { path });
      throw new CompanionRequestError('connection_failed', { path });
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({
    health: () => request('GET', '/health', { authenticated: false }),
    capabilities: () => request('GET', '/capabilities'),
    lastError: () => request('GET', '/last-error'),
    activeWindow: () => request('GET', '/v1/active-window'),
    see: () => request('POST', '/v1/see'),
    startWatch: () => request('POST', '/v1/watch/start'),
    stopWatch: () => request('POST', '/v1/watch/stop'),
  });
}

export function createCompanionClientFromEnv(env = process.env, options = {}) {
  return createCompanionClient({
    ...options,
    baseUrl: env.VERIDAN_COMPANION_URL ?? DEFAULT_BASE_URL,
    token: env.VERIDAN_COMPANION_TOKEN,
  });
}

function validateBaseUrl(value) {
  const url = new URL(value);
  const safe = url.protocol === 'http:'
    && url.hostname === '127.0.0.1'
    && url.username === ''
    && url.password === ''
    && (url.pathname === '/' || url.pathname === '')
    && url.search === ''
    && url.hash === '';
  if (!safe) throw new Error('Windows Companion URL must be an uncredentialed http://127.0.0.1 origin.');
  return url;
}
