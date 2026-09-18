import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix, win32 } from 'node:path';
import { homedir } from 'node:os';

export function defaultAuditPath(env = process.env, platform = process.platform) {
  if (env.VERIDAN_CORE_AUDIT_PATH) return env.VERIDAN_CORE_AUDIT_PATH;

  const pathApi = platform === 'win32' ? win32 : posix;
  const base = platform === 'win32'
    ? (env.LOCALAPPDATA ?? pathApi.join(homedir(), 'AppData', 'Local'))
    : (env.XDG_STATE_HOME ?? pathApi.join(homedir(), '.local', 'state'));
  return pathApi.join(base, 'Veridan', 'Core', 'audit.jsonl');
}

export function createCoreStore({ path = defaultAuditPath() } = {}) {
  if (typeof path !== 'string' || path.length === 0) throw new Error('Core audit path is required.');

  return Object.freeze({
    path,
    append(record) {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'a' });
    },
    replay() {
      let contents;
      try {
        contents = readFileSync(path, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw coded('core_audit_replay_failed', error);
      }

      const records = [];
      const eventIds = new Set();
      for (const line of contents.split(/\r?\n/)) {
        if (!line.trim()) continue;
        let record;
        try {
          record = JSON.parse(line);
        } catch {
          continue;
        }
        if (!isEventRecord(record) || eventIds.has(record.event_id)) continue;
        eventIds.add(record.event_id);
        records.push(record);
      }
      return records;
    },
  });
}

function isEventRecord(record) {
  return record
    && record.record_type === 'event'
    && typeof record.event_id === 'string'
    && typeof record.type === 'string'
    && typeof record.occurred_at === 'string'
    && record.payload
    && typeof record.payload === 'object'
    && !Array.isArray(record.payload)
    && Object.keys(record).every((key) => ['record_type', 'event_id', 'type', 'occurred_at', 'payload'].includes(key));
}

function coded(code, cause) {
  const error = new Error(`Core audit store failed: ${code}`);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}
