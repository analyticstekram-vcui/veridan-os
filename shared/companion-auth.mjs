import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const DEFAULT_WINDOW_MS = 30_000;
const MAX_NONCES = 1_000;

export function createSignedHeaders({ method, path, token, timestamp = new Date().toISOString(), nonce = randomUUID() }) {
  const signature = sign({ method, path, timestamp, nonce, token });
  return Object.freeze({
    Authorization: `Bearer ${token}`,
    'X-Veridan-Timestamp': timestamp,
    'X-Veridan-Nonce': nonce,
    'X-Veridan-Signature': signature,
  });
}

export function createRequestAuthenticator({ token, now = () => Date.now(), windowMs = DEFAULT_WINDOW_MS } = {}) {
  if (typeof token !== 'string' || token.length < 32) throw new Error('Companion authentication requires a strong token.');
  const seenNonces = new Map();

  return function authenticate(request, path) {
    const authorization = header(request, 'authorization');
    if (!authorization.startsWith('Bearer ') || !safeEqual(authorization.slice(7), token)) return deny('bearer');

    const timestamp = header(request, 'x-veridan-timestamp');
    const nonce = header(request, 'x-veridan-nonce');
    const signature = header(request, 'x-veridan-signature');
    const timestampMs = Date.parse(timestamp);
    const currentTime = now();
    prune(seenNonces, currentTime, windowMs);

    if (!Number.isFinite(timestampMs) || Math.abs(currentTime - timestampMs) > windowMs) return deny('timestamp');
    if (!/^[A-Za-z0-9-]{16,128}$/.test(nonce) || seenNonces.has(nonce)) return deny('nonce');

    const expected = sign({ method: request.method ?? 'GET', path, timestamp, nonce, token });
    if (!safeEqual(signature, expected)) return deny('signature');

    seenNonces.set(nonce, currentTime);
    if (seenNonces.size > MAX_NONCES) seenNonces.delete(seenNonces.keys().next().value);
    return Object.freeze({ ok: true });
  };
}

export function sign({ method, path, timestamp, nonce, token }) {
  const canonical = `${String(method).toUpperCase()}\n${path}\n${timestamp}\n${nonce}`;
  return createHmac('sha256', token).update(canonical).digest('base64url');
}

function header(request, name) {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function safeEqual(left, right) {
  const leftHash = createHash('sha256').update(String(left)).digest();
  const rightHash = createHash('sha256').update(String(right)).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function prune(seenNonces, currentTime, windowMs) {
  for (const [nonce, observedAt] of seenNonces) {
    if (currentTime - observedAt > windowMs) seenNonces.delete(nonce);
  }
}

function deny(reason) {
  return Object.freeze({ ok: false, reason });
}
