# Veridan Core system map

## Repository directories

- `base44/` — Base44 app configuration, entity schemas, and backend functions.
- `companion/` — Windows-local sensory service, PowerShell installers, and verification tests.
- `core/` — authoritative system, agent, capability, connector, policy, event, routing, trading, memory, gateway, and retrieval contracts.
- `docs/` — milestone records, bridge instructions, verification reports, and operating notes.
- `gateway/` — Command Desk manifest, Windows installer documentation, and installer tests.
- `mind-vault/` — authenticated local Mind Vault retrieval bridge, manifest, installer documentation, and tests.
- `runtime/` — local governed router, policy engine, orchestrator, event bus, clients, dispatchers, and Command Desk server.
- `scripts/` — launchers, doctor checks, and local preflight scripts.
- `shared/` — shared request-authentication helpers.
- `src/` — React/Vite Base44 interface, pages, UI components, adapters, and planning surfaces.
- `test/` — Core, memory, Companion integration, and Command Desk tests.

## Local ports

| Service | Port | Boundary |
| --- | ---: | --- |
| Command Desk | 4700 | Loopback, same-origin, read-only memory search |
| Windows Companion | 4701 | Loopback, authenticated sensory observations |
| Vault Agent bridge | 57445 | Loopback, fixed report files, GET-only |
| Mind Vault retrieval bridge | 57446 | Loopback, authenticated fixed-scope Markdown retrieval |

The repository does not establish that external connectors, VPS services, or these local services are currently running on a target machine. Live status requires direct verification.

## Main flows

Human commands may enter through ChatGPT or the Veridan UI. The local governed runtime routes them deterministically, evaluates policy, dispatches only registered capabilities, and reports completion only after verification. Mind Vault retrieval returns source IDs, scoped paths, titles, and bounded excerpts. The Windows Companion returns ephemeral sensory observations. The Command Desk is intentionally narrower than the general router and exposes only `memory.search`.

