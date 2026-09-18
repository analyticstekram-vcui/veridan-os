# Current architecture

```text
Human / ChatGPT / Veridan UI
        |
        v
Base44 application
        |
        +-- Base44 functions/entities
        |
        +-- Local Veridan Core runtime
              |
              +-- deterministic router
              +-- policy engine
              +-- event bus
              +-- Windows Companion client
              +-- Mind Vault client
              +-- Command Desk gateway
```

## Local governed runtime

- `runtime/router.mjs` normalizes natural-language commands, resolves registered intent rules, and denies unknown intent.
- `runtime/orchestrator.mjs` loads contracts, routes commands, dispatches only allowlisted Companion and memory capabilities, publishes verified events, and fails closed on verification errors.
- `runtime/policy-engine.mjs` applies risk, mode, approval, and hard-denial rules.
- `runtime/contracts.mjs` loads the JSON contracts from `core/`, `mind-vault/`, `gateway/`, and `companion/`.
- `runtime/event-bus.mjs` validates registered event shapes, keeps immutable event history in process memory, and optionally appends sanitized event projections through `runtime/core-store.mjs`.
- `runtime/core-store.mjs` provides append-only local JSONL audit storage and replay. The real Command Desk launcher configures the default store under `%LOCALAPPDATA%\\Veridan\\Core\\audit.jsonl` on Windows; tests and other callers may keep the bus in memory or provide an explicit path.
- `runtime/companion-dispatcher.mjs` exposes only signed `screen.see` and user-directed `screen.watch.prepare` dispatch.
- `runtime/memory-dispatcher.mjs` verifies source-backed, scoped, read-only Mind Vault responses.
- `runtime/command-gateway.mjs` serves the local Command Desk and exposes only `memory.search` through same-origin `POST /v1/commands`.

## Mind Vault

`mind-vault/server.mjs` is a loopback HTTP bridge on port 57446. It authenticates non-health requests with bearer plus HMAC-SHA256 signing, reads only fixed allowlisted Markdown roots, rejects browser origins and arbitrary paths, and returns bounded source citations. Retrieval is read-only; note bodies are response-only and event history stores source identifiers only. Approved Obsidian writes are a separate workflow and are not part of retrieval.

Ranking uses `exact_phrase_path_title_domain_v1`. Exact phrases, path and filename matches, and titles outrank incidental body matches. Trading terms receive a bounded boost only under `03 Trading` and `Trading`. Generic headings fall back to filenames. The Command Desk renders the top source’s verbatim excerpt and citation instead of generating a summary.

## Command Desk

The gateway at `127.0.0.1:4700` serves a local HTML surface. It requires the exact loopback Host and same-origin browser request, accepts a bounded command payload, routes through the real Core orchestrator, and returns source-backed excerpts. The Mind Vault token stays in the launcher process and is never returned to browser code.

## Windows Companion

`companion/windows/` provides loopback sensory observations on port 4701: health, heartbeat, active window, ephemeral SEE, and visible WATCH with local frame comparison. Requests are signed with bearer plus HMAC-SHA256, timestamps, and one-use nonces. The service cannot type, click, execute arbitrary commands, automate browsers, trade, move money, or monitor invisibly. Installers use limited current-user scheduled tasks and DPAPI-protected tokens.

## Base44 application and backend

`src/` is the React/Vite Base44 interface. `base44/entities/` defines persisted application records, and `base44/functions/` contains backend functions for Veridan routing, OpenClaw status and governance, Obsidian workflows, TradingView alerts, APNs readiness, and related planning surfaces. `base44/config.jsonc` identifies Base44 as the application runtime.

## Architectural split

Two paths coexist and are not already unified:

1. The newer governed local runtime under `runtime/`, with deterministic routing, explicit contracts, fail-closed policy, local signed bridges, and source verification.
2. The older Base44 `veridanApi` function under `base44/functions/veridanApi/entry.ts`, which still uses LLM classification, a fixed VPS target, and in-memory request logs.

The repository documents migration controls as unfinished in `docs/JARVIS_INTEGRATION_MILESTONE_1.md`.

## MCP, persistence, and trading

`core/mcp-registry.json` records connector boundaries for GitHub, TradingView MCP, the Tekram paper API, Obsidian, OpenClaw, Windows Companion, and Command Desk. Registry presence does not prove live external availability.

Mind Vault notes are filesystem Markdown. Base44 entities provide application persistence. UI planning state uses browser localStorage. Local Core event history is process-local memory by default; the real Command Desk runtime opts into sanitized append-only JSONL audit history outside the repository. Persisted projections contain identifiers, policy outcomes, verification names, source identifiers, and bounded counts only. They never contain Mind Vault text, excerpts, screenshots, tokens, credentials, or arbitrary metadata. Durable approval lifecycle and authority remain unimplemented. Trading calculations and meanings are defined by `core/tekram-contract.json`; the contract keeps trading `PAPER_ONLY`, disables live execution and money movement, and denies live broker behavior.

