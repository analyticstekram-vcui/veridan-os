import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPowerShell } from './powershell.mjs';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const scriptsDir = resolve(sourceDir, '..', 'scripts');

export function createWindowsSensors() {
  let seeInFlight = false;

  return Object.freeze({
    async activeWindow() {
      return parseJson(await runPowerShell(resolve(scriptsDir, 'active-window.ps1')));
    },
    async see() {
      if (seeInFlight) throw new Error('A screen capture is already in progress.');
      seeInFlight = true;
      let capturePath;
      try {
        const result = parseJson(await runPowerShell(resolve(scriptsDir, 'capture-screen.ps1')));
        capturePath = trustedCapturePath(result.path);
        const bytes = await readFile(capturePath);
        return {
          mimeType: 'image/png',
          data: bytes.toString('base64'),
          width: result.width,
          height: result.height,
          capturedAt: result.capturedAt,
          ephemeral: true,
        };
      } finally {
        if (capturePath) await unlink(capturePath).catch(() => {});
        seeInFlight = false;
      }
    },
    async sampleScreen() {
      return parseJson(await runPowerShell(resolve(scriptsDir, 'screen-sample.ps1')));
    },
  });
}

function trustedCapturePath(value) {
  if (typeof value !== 'string') throw new Error('Windows screen capture returned an invalid temporary path.');
  const capturePath = resolve(value);
  if (dirname(capturePath) !== resolve(tmpdir()) || !basename(capturePath).startsWith('veridan-see-')) {
    throw new Error('Windows screen capture returned an untrusted temporary path.');
  }
  return capturePath;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Windows sensor returned invalid JSON.');
  }
}
