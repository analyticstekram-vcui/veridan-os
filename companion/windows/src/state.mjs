export function createState(clock = () => new Date()) {
  const startedAt = clock().toISOString();
  let lastHeartbeatAt = startedAt;
  let lastError = null;
  let watch = watchStopped();

  return {
    heartbeat() {
      lastHeartbeatAt = clock().toISOString();
      return lastHeartbeatAt;
    },
    recordError(source, error) {
      lastError = Object.freeze({
        source,
        message: error instanceof Error ? error.message : String(error),
        occurredAt: clock().toISOString(),
      });
      return lastError;
    },
    clearError() {
      lastError = null;
    },
    setWatch(next) {
      watch = Object.freeze({ ...watch, ...next });
      return watch;
    },
    snapshot() {
      return Object.freeze({ startedAt, lastHeartbeatAt, lastError, watch });
    },
  };
}

function watchStopped() {
  return Object.freeze({
    active: false,
    visibleIndicator: false,
    startedAt: null,
    lastChangedAt: null,
    unchangedForMs: 0,
    sampleCount: 0,
  });
}
