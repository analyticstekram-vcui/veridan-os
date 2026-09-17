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
const GENERIC_HEADINGS = new Set(['purpose', 'scope', 'overview', 'notes', 'summary']);
const TRADING_TERMS = new Set(['zero', 'cross', 'signal', 'macd', 'ema', 'nq', 'mnq', 'tekram', 'trading', 'chart', 'rsi', 'momentum', 'trend', 'ladder']);

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
      if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { status: 'ok', component: 'veridan-mind-vault-bridge', version: '0.2.0', readOnly: true, timestamp: clock().toISOString() });
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
  const analysis = analyzeQuery(query);
  const candidates = await Promise.all(files.slice(0, MAX_NOTES).map((path) => scoreNote(path, root, analysis)));
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

async function scoreNote(filePath, root, analysis) {
  const info = await stat(filePath);
  if (info.size > MAX_NOTE_BYTES) return null;
  const text = await readFile(filePath, 'utf8');
  const path = relative(root, filePath).split(sep).join('/');
  if (!isAllowedRelativePath(path)) return null;
  const title = noteTitle(text, path);
  const body = text.toLowerCase();
  const titleLower = title.toLowerCase();
  const pathLower = path.toLowerCase();
  const searchableBody = normalizeSearchText(body);
  const searchableTitle = normalizeSearchText(titleLower);
  const searchablePath = normalizeSearchText(pathLower);
  const exactPhraseMatched = analysis.phrases.length === 0 || analysis.phrases.some((phrase) => searchablePath.includes(phrase) || searchableTitle.includes(phrase) || searchableBody.includes(phrase));
  if (!exactPhraseMatched) return null;
  const termScore = analysis.terms.reduce((total, term) => total
    + (pathLower.includes(term) ? 12 : 0)
    + (titleLower.includes(term) ? 8 : 0)
    + Math.min(4, count(body, term)), 0);
  const phraseScore = analysis.phrases.reduce((total, phrase) => total
    + (searchablePath.includes(phrase) ? 60 : 0)
    + (searchableTitle.includes(phrase) ? 45 : 0)
    + (searchableBody.includes(phrase) ? 24 : 0), 0);
  const domainScore = analysis.tradingIntent && isTradingPath(path) ? 32 : 0;
  const score = termScore + phraseScore + domainScore;
  if (score === 0) return null;
  return { sourceId: createHash('sha256').update(path).digest('hex').slice(0, 20), path, title, excerpt: excerpt(text, analysis), updatedAt: info.mtime.toISOString(), score };
}

function validateQuery(value) {
  const query = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 256) { const error = new Error('Query must be 2-256 characters.'); error.code = 'invalid_query'; throw error; }
  return query;
}
function analyzeQuery(query) {
  const normalized = query.toLowerCase();
  const terms = tokenize(normalized);
  const phrases = ['zero cross', 'signal cross', 'signal mirror', 'tp ladder', 'ema 2', 'ema 25', 'ema 200']
    .filter((phrase) => normalized.includes(phrase));
  const tradingIntent = phrases.length > 0 || terms.some((term) => TRADING_TERMS.has(term));
  return Object.freeze({ terms, phrases, tradingIntent });
}
function tokenize(value) { return [...new Set(value.match(/[a-z0-9][a-z0-9_-]*/g) ?? [])].filter((term) => term.length > 1).slice(0, 16); }
function normalizeSearchText(value) { return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' '); }
function count(text, needle) { return text.split(needle).length - 1; }
function noteTitle(text, path) { const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim(); return heading && !GENERIC_HEADINGS.has(heading.toLowerCase()) ? heading : path.split('/').at(-1).replace(/\.md$/i, ''); }
function isTradingPath(path) { return path === '03 Trading' || path.startsWith('03 Trading/') || path === 'Trading' || path.startsWith('Trading/'); }
function excerpt(text, analysis) { const flattened = text.replace(/\s+/g, ' ').trim(); const lower = flattened.toLowerCase(); const matches = [...analysis.phrases, ...analysis.terms].map((term) => lower.indexOf(term)).filter((value) => value >= 0); const index = matches.sort((a, b) => a - b)[0] ?? 0; return flattened.slice(Math.max(0, index - 120), index + 380).slice(0, 500); }
function isScoped(filePath, root) { const rel = relative(root, filePath); return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.includes(`${sep}.${sep}`); }
function isAllowedRelativePath(path) { return !path.startsWith('/') && ALLOWED_ROOTS.some((root) => path === root || path.startsWith(`${root}/`)); }
function securityHeaders(response) { response.setHeader('Cache-Control', 'no-store'); response.setHeader('Content-Security-Policy', "default-src 'none'"); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'no-referrer'); }
function json(response, status, body) { const encoded = JSON.stringify(body); response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(encoded) }); response.end(encoded); }
