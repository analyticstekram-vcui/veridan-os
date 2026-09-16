# Veridan Windows Companion v1

The companion is Veridan's Windows-local sensory layer. It observes machine state through fixed, bundled sensors and exposes bounded results on loopback. It is not an executor and cannot run arbitrary commands, type, click, automate a browser, trade, or move money.

## Security and privacy

- binds only to `127.0.0.1`;
- requires a bearer token of at least 32 characters for every non-health route;
- rejects requests carrying a browser `Origin` header;
- captures a fresh frame only for an authenticated `SEE` request;
- deletes the temporary PNG before returning the response;
- performs WATCH frame comparison locally on a 32×18 grayscale sample;
- starts WATCH only if a visible, topmost indicator can be displayed;
- provides STOP controls in both the indicator and tray menu;
- stores only timestamps, counters, and the last error in process memory.

## Install on the Acer Windows PC

Prerequisites: Node.js 20+ and Windows PowerShell 5.1+.

From an elevated or normal PowerShell prompt at the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\companion\windows\scripts\install.ps1
```

The installer:

1. stops an existing Companion scheduled task and its verified port-4701 process before rotating credentials;
2. generates a 384-bit random bearer token;
3. protects it with Windows DPAPI for the current user;
4. creates a Task Scheduler entry that runs at logon;
5. starts the companion immediately.

The scheduled companion and tray host run without console windows. WATCH remains intentionally visible whenever it is active.

On reinstall, the installer fails closed if port `4701` belongs to anything other than the bundled Companion entry point. It does not rotate the DPAPI token until the old listener is verified, stopped, and the port is released.

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:4701/health
```

Run the authenticated live preflight:

```powershell
powershell -ExecutionPolicy Bypass -File .\companion\windows\scripts\verify.ps1
```

The authenticated routes are intended for Veridan Core. The token is never printed or stored in the repository.

## Routes

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| GET | `/health` | No | Minimal liveness and heartbeat state |
| GET | `/capabilities` | Bearer | Declared sensory capabilities |
| GET | `/last-error` | Bearer | Most recent process-local diagnostic |
| GET | `/v1/active-window` | Bearer | Fresh foreground-window observation |
| POST | `/v1/see` | Bearer | Fresh, ephemeral PNG frame |
| POST | `/v1/watch/start` | Bearer | Start visible local frame-diff monitoring |
| POST | `/v1/watch/stop` | Bearer | Stop WATCH and remove its indicator |

## Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File .\companion\windows\scripts\uninstall.ps1
```

This removes the scheduled task and the DPAPI-protected local token.
