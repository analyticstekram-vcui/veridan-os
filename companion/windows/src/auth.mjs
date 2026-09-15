import { createHash, timingSafeEqual } from 'node:crypto';

export function isAuthorized(request, expectedToken) {
  const header = request.headers.authorization ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return safeEqual(header.slice(prefix.length), expectedToken);
}

function safeEqual(left, right) {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
