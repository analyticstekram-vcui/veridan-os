# Jarvis Integration Milestone 5 — Local Command Gateway

## Outcome

Veridan now has a local Command Desk at `http://127.0.0.1:4700/`. It takes a natural-language request and uses the real Core router to retrieve source-cited results from the authenticated, read-only Mind Vault bridge.

## Deliberate boundary

The hosted Base44 interface is not connected directly to a local privileged service. A hosted page cannot safely hold a local bridge secret or silently obtain desktop capabilities. This milestone adds the correct local command surface first, with exact same-origin enforcement and no browser-held credential.

## Exposed capability

| Capability | Route | Mode | Result |
| --- | --- | --- | --- |
| `memory.search` | `POST /v1/commands` | `READ_ONLY` | scoped source citations |

All other router capabilities return `capability_not_exposed`. In particular, the Command Desk cannot control the Windows Companion, start screen watching, call OpenClaw, invoke external APIs, automate a browser, write to Obsidian, or access trading/banking functions.

## Runtime

The Windows installer creates a hidden, limited, current-user scheduled task named `Veridan Command Gateway`. It reads the already protected Mind Vault token only inside the launcher process; the token is never placed in browser code or returned by any Command Desk route.

## Verify on the Windows host

```powershell
cd "$HOME\veridan-os"
powershell -ExecutionPolicy Bypass -File .\gateway\windows\scripts\install.ps1
powershell -ExecutionPolicy Bypass -File .\gateway\windows\scripts\verify.ps1
```

Open `http://127.0.0.1:4700/` only after the verifier reports all passes.
