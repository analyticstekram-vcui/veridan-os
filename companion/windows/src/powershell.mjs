import { spawn } from 'node:child_process';

export function runPowerShell(scriptPath, { env = {}, timeoutMs = 10000 } = {}) {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Windows sensor capability is available only on win32.'));
  }

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
    ], {
      env: { ...process.env, ...env },
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`PowerShell sensor timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`PowerShell sensor exited ${code}: ${stderr.trim() || 'unknown error'}`));
    });
  });
}

export function spawnPowerShell(scriptPath, { env = {} } = {}) {
  if (process.platform !== 'win32') return null;
  return spawn('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-STA',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
  ], {
    env: { ...process.env, ...env },
    windowsHide: false,
    shell: false,
    stdio: 'ignore',
  });
}
