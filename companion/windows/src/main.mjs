import { loadConfig } from './config.mjs';
import { Heartbeat } from './heartbeat.mjs';
import { createCompanionServer } from './server.mjs';
import { createWindowsSensors } from './sensors.mjs';
import { createState } from './state.mjs';
import { VisibilityController } from './visibility.mjs';
import { WatchMonitor } from './watch-monitor.mjs';

const config = loadConfig();
if (process.platform !== 'win32') throw new Error('Veridan Windows Companion must run on Windows.');

const state = createState();
const sensors = createWindowsSensors();
const heartbeat = new Heartbeat({ intervalMs: config.heartbeatIntervalMs, onBeat: () => state.heartbeat() });
let watch;
const visibility = new VisibilityController(config, {
  onIndicatorLost: () => {
    if (!watch?.active) return;
    watch.stop();
    state.setWatch({ active: false, visibleIndicator: false });
    state.recordError('watch_indicator', new Error('WATCH stopped because its visible indicator closed.'));
  },
});
watch = new WatchMonitor({
  sampleScreen: () => sensors.sampleScreen(),
  intervalMs: config.watchIntervalMs,
  unchangedThresholdMs: config.watchUnchangedThresholdMs,
  differenceThreshold: config.watchDifferenceThreshold,
  onState: (next) => state.setWatch(next),
  onError: (error) => state.recordError('screen_watch', error),
});
const server = createCompanionServer({ config, state, sensors, watch, visibility });

const address = await server.listen();
heartbeat.start();
visibility.startTray();
console.log(`Veridan Windows Companion listening on http://${address.address}:${address.port}`);

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Stopping Veridan Windows Companion (${signal}).`);
  watch.stop();
  heartbeat.stop();
  visibility.stop();
  await server.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('uncaughtException', (error) => {
  state.recordError('uncaught_exception', error);
  console.error(error);
  void shutdown('uncaughtException').finally(() => { process.exitCode = 1; });
});
process.once('unhandledRejection', (error) => {
  state.recordError('unhandled_rejection', error);
  console.error(error);
  void shutdown('unhandledRejection').finally(() => { process.exitCode = 1; });
});
