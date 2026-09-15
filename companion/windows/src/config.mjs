const LOOPBACK_HOST = '127.0.0.1';
const DEFAULT_PORT = 4701;
const MIN_TOKEN_LENGTH = 32;

export function loadConfig(env = process.env) {
  const port = Number(env.VERIDAN_COMPANION_PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('VERIDAN_COMPANION_PORT must be an integer between 0 and 65535.');
  }

  const token = env.VERIDAN_COMPANION_TOKEN ?? '';
  if (token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`VERIDAN_COMPANION_TOKEN must contain at least ${MIN_TOKEN_LENGTH} characters.`);
  }

  return Object.freeze({
    host: LOOPBACK_HOST,
    port,
    token,
    heartbeatIntervalMs: positiveInteger(env.VERIDAN_HEARTBEAT_INTERVAL_MS, 5000),
    watchIntervalMs: positiveInteger(env.VERIDAN_WATCH_INTERVAL_MS, 2000),
    watchUnchangedThresholdMs: positiveInteger(env.VERIDAN_WATCH_UNCHANGED_MS, 30000),
    watchDifferenceThreshold: boundedNumber(env.VERIDAN_WATCH_DIFFERENCE_THRESHOLD, 8, 0, 255),
  });
}

function positiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Expected a positive integer, received ${value}.`);
  return parsed;
}

function boundedNumber(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected a number between ${minimum} and ${maximum}, received ${value}.`);
  }
  return parsed;
}
