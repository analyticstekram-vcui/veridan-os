import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { createServer } from 'node:http';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { createRequestAuthenticator } from '../shared/companion-auth.mjs';

const DEFAULT_ROOT = resolve(homedir(), 'OneDrive', 'Desktop', 'obsidians', 'veridans mind');
const ALLOWED_ROOTS = Object.freeze(['00 Dashboard', '01 System Map', '02 Veridan Operator', '03 Trading', '04 Governance', '05 SOPs', '06 Trust', '07 LLCs', 'Captures', 'Research', 'Trading', 'Veridan', 'Businesses']);
const MAX_NOTE_BYTES = 512 * 1024;
const MAX_NOTES = 1_000;
const MAX_RESULTS = 5;

export function loadMindVaultConfig(env = process.env) {
  const port = Number(env.VERIDAN_MIND_VAULT_PORT ?? 57446);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('VERIDAN_MIND_VAULT_PORT must be an integer between 0 and 65535.');
  const token = env.VERIDAN_MIND_VAULT_TOKEN ?? '';
  if (token.length < 32) throw new Error('VERIDAN_MIND_VAULT_TOKEN must contain at least 32 characters.');
  return Object.freeze({ host: '127.0.0.1', port, token, root: DEFAULT_ROOT, signatureWindowMs: 30_000 });
}

export function createMindVaultServer({ config, clock = () => new Date() }) {
  const authenticate = createRequestAuthenticator({ token: config.token, now: () => clock().getTime(), windowMs: config.signatureWindowMs });
  const server = createServer(async (request, response) => {
    securityHeaders(response);
    try {
      if (request.headers.origin) return json(response, 403, { error: 'browser_origin_rejected' });
      const url = new URL(request.url ?? '/', `http://${config.host}`);
      if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { status: 'ok', component: 'veridan-mind-vault-bridge', version: '0.1.0', readOnly: true, timestamp: clock().toISOString() });
      const authorization = authenticate(request, `${url.pathname}${url.search}`);
      if (!authorization.ok) return json(response, 401, { error: 'unauthorized' });
      if (request.method === 'GET' && url.pathname === '/mind-vault/status') return json(response, 200, { status: 'ok', readOnly: true, sourceScope: ALLOWED_ROOTS, maxResults: MAX_RESULTS });
      if (request.method === 'GET' && url.pathname === '/mind-vault/search') {
        const query = validateQuery(url.searchParams.get('q'));
        const sources = await searchVault(config.root, query);
        return json(response, 200, { envelopeVersion: '1.0', source: 'obsidian-mind-vault', capability: 'memory_search', observedAt: clock().toISOString(), readOnly: true, writesEnabled: false, query, sources });
      }
      return json(response, 404, { error: 'not_found' });
    } catch (error) {
      const status = error.code === 'invalid_query' ? 400 : 500;
      return json(response, status, { error: error.code ?? 'mind_vault_error' });
    }
  });
  return { raw: server, listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, () => { server.off('error', reject); resolve(server.address()); }); }), close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

export async function searchVault(root, query) {
  const files = [];
  for (const allowed of ALLOWED_ROOTS) await collectMarkdown(resolve(root, allowed), root, files);
  const terms = tokenize(query);
  const candidates = await Promise.all(files.slice(0, MAX_NOTES).map((path) => scoreNote(path, root, terms)));
  return candidates.filter(Boolean).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, MAX_RESULTS);
}

async function collectMarkdown(directory, root, output) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || output.length >= MAX_NOTES) continue;
    const fullPath = resolve(directory, entry.name);
    if (!isScoped(fullPath, root)) continue;
    if (entry.isDirectory()) await collectMarkdown(fullPath, root, output);
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') output.push(fullPath);
  }
}

async function scoreNote(filePath, root, terms) {
  const info = await stat(filePath);
  if (info.size > MAX_NOTE_BYTES) return null;
  const text = await readFile(filePath, 'utf8');
  const path = relative(root, filePath).split(sep).join('/');
  if (!isAllowedRelativePath(path)) return null;
  const title = firstTitle(text) ?? path.split('/').at(-1).replace(/\.md$/i, '');
  const body = text.toLowerCase();
  const titleLower = title.toLowerCase();
  const score = terms.reduce((total, term) => total + (titleLower.includes(term) ? 4 : 0) + count(body, term), 0);
  if (score === 0) return null;
  return { sourceId: createHash('sha256').update(path).digest('hex').slice(0, 20), path, title, excerpt: excerpt(text, terms), updatedAt: info.mtime.toISOString(), score };
}

function validateQuery(value) {
  const query = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 256) { const error = new Error('Query must be 2-256 characters.'); error.code = 'invalid_query'; throw error; }
  return query;
}
function tokenize(value) { return [...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? [])].filter((term) => term.length > 1).slice(0, 16); }
function count(text, needle) { return text.split(needle).length - 1; }
function firstTitle(text) { return text.match(/^#\s+(.+)$/m)?.[1]?.trim(); }
function excerpt(text, terms) { const flattened = text.replace(/\s+/g, ' ').trim(); const index = terms.map((term) => flattened.toLowerCase().indexOf(term)).filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? 0; return flattened.slice(Math.max(0, index - 120), index + 380).slice(0, 500); }
function isScoped(filePath, root) { const rel = relative(root, filePath); return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.includes(`${sep}.${sep}`); }
function isAllowedRelativePath(path) { return !path.startsWith('/') && ALLOWED_ROOTS.some((root) => path === root || path.startsWith(`${root}/`)); }
function securityHeaders(response) { response.setHeader('Cache-Control', 'no-store'); response.setHeader('Content-Security-Policy', "default-src 'none'"); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'no-referrer'); }
function json(response, status, body) { const encoded = JSON.stringify(body); response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(encoded) }); response.end(encoded); }
