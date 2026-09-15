import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnPowerShell } from './powershell.mjs';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const scriptsDir = resolve(sourceDir, '..', 'scripts');

export class VisibilityController {
  #config;
  #onIndicatorLost;
  #tray = null;
  #indicator = null;
  #indicatorStopping = false;

  constructor(config, { onIndicatorLost = () => {} } = {}) {
    this.#config = config;
    this.#onIndicatorLost = onIndicatorLost;
  }

  startTray() {
    if (this.#tray) return;
    this.#tray = spawnPowerShell(resolve(scriptsDir, 'tray.ps1'), {
      env: this.#environment(),
      windowsHide: true,
    });
    this.#tray?.once('exit', () => { this.#tray = null; });
  }

  async showWatchIndicator() {
    if (this.#indicator) return true;
    const readyFile = resolve(tmpdir(), `veridan-indicator-${randomUUID()}.ready`);
    this.#indicator = spawnPowerShell(resolve(scriptsDir, 'watch-indicator.ps1'), {
      env: { ...this.#environment(), VERIDAN_INDICATOR_READY_FILE: readyFile },
    });
    if (!this.#indicator) return false;
    this.#indicator.once('exit', () => {
      const wasExpected = this.#indicatorStopping;
      this.#indicator = null;
      this.#indicatorStopping = false;
      if (!wasExpected) this.#onIndicatorLost();
    });
    const ready = await waitForFile(readyFile, 5000);
    await unlink(readyFile).catch(() => {});
    if (!ready) this.hideWatchIndicator();
    return ready;
  }

  hideWatchIndicator() {
    if (this.#indicator) {
      this.#indicatorStopping = true;
      this.#indicator.kill();
    }
    this.#indicator = null;
  }

  stop() {
    this.hideWatchIndicator();
    this.#tray?.kill();
    this.#tray = null;
  }

  #environment() {
    return {
      VERIDAN_COMPANION_TOKEN: this.#config.token,
      VERIDAN_COMPANION_PORT: String(this.#config.port),
    };
  }
}

async function waitForFile(path, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await access(path);
      return true;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
  }
  return false;
}
