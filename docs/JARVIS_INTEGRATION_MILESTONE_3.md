# Jarvis Integration Milestone 3

## Outcome

Veridan Core can now dispatch two sensory capabilities to the authenticated Windows Companion and prove their safety properties before returning `completed`. This is a narrow local integration, not a general desktop-control channel.

Repository validation is complete. The contract remains an integration candidate until the Windows live preflight below passes against the reinstalled Companion.

## Connected capabilities

| Core capability | Companion route | Policy gate | Completion proof |
|---|---|---|---|
| `screen.see` | `POST /v1/see` | Risk 0 observe | Fresh timestamp, known source, PNG payload, ephemeral retention |
| `screen.watch.prepare` | `POST /v1/watch/start` | Direct user direction | Active WATCH, visible indicator, stop control, ephemeral retention |

No other capability can use the dispatcher. Paths and methods are hardcoded in the client and integration contract.

## Authentication and replay defense

Every non-health request carries a bearer token and an HMAC-SHA256 signature over:

```text
METHOD
PATH
TIMESTAMP
NONCE
```

The Companion rejects stale timestamps, reused nonces, invalid signatures, missing credentials, and browser-origin requests. The signing token remains protected with Windows DPAPI and is loaded only into the local Companion and Core preflight processes.

## Data boundary

SEE returns the fresh PNG to the immediate Core caller in memory. Core emits only the observation ID, source, capability, correlation ID, and verification names. Screenshot bytes are never copied into event history. WATCH continues to compare frames locally and cannot start without its visible indicator.

## Failure behavior

- Unknown and non-allowlisted capabilities do not dispatch.
- Missing user direction stops WATCH at policy evaluation.
- Failed transport, malformed responses, stale observations, hidden WATCH, or missing verification return `failed`.
- Core emits `action.failed`; it never reports `completed` without verification.
- Error objects do not include the signing token or remote response body.

## Verification

Repository checks:

```bash
npm run test:companion
npm run test:core
npm run veridan:doctor
```

Windows live checks, after pulling `main` and reinstalling the Companion:

```powershell
powershell -ExecutionPolicy Bypass -File .\companion\windows\scripts\install.ps1
powershell -ExecutionPolicy Bypass -File .\companion\windows\scripts\verify.ps1
powershell -ExecutionPolicy Bypass -File .\companion\windows\scripts\verify-core-integration.ps1
```

The last command performs real signed SEE and visible WATCH requests through Veridan Core, proves event history contains no frame bytes, and stops WATCH before exiting.

## Boundaries retained

Desktop input, shell execution, browser automation, arbitrary HTTP paths, broker connectivity, live orders, purchases, transfers, and money movement remain disabled. TEKRAM remains `PAPER_ONLY`.
