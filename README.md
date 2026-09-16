# Veridan Core v1

Veridan Core is the orchestration layer for the Tekram Analytics AI ecosystem.

It is designed to sit between the human interface, currently ChatGPT, and the execution network made of agents, MCP servers, apps, widgets, APIs, and automation workflows.

## System model

```text
User
  -> ChatGPT Interface
    -> Veridan Core Router
      -> Agent Hub
      -> MCP Hub
      -> Memory Hub
      -> Automation Engine
        -> External Services
```

## Phase 1 goal

Create a working foundation that can:

1. Register agents.
2. Register MCP servers and external tool bridges.
3. Route a user command to the right agent.
4. Track capabilities and permissions.
5. Prepare the system for automation, memory, and dashboard interfaces.

The hardened core now routes and authorizes capabilities and can dispatch only the two allowlisted sensory operations described below. All other external action dispatch remains disabled.

## Mind Vault retrieval

Milestone 4 adds a dedicated, authenticated localhost bridge for the registered `memory.search` capability. It is read-only, searches only fixed allowlisted Markdown folders in the Obsidian Mind Vault, and returns short citations (`sourceId`, vault-relative `path`, title, excerpt). Core events retain source identifiers only—never note text. See [Milestone 4](docs/JARVIS_INTEGRATION_MILESTONE_4.md) for the local Windows install and verification.

## Core modules

- `core/router.json` - command routing rules.
- `core/agent-registry.json` - known agents and their capabilities.
- `core/mcp-registry.json` - known MCP servers and tool bridges.
- `core/system-manifest.json` - top-level system identity and operating principles.
- `core/capability-registry.json` - bounded operations, modes, risk levels, and verification requirements.
- `core/event-catalog.json` - events permitted on the Veridan event bus.
- `core/policy.json` - permission levels and non-bypassable denials.
- `core/tekram-contract.json` - authoritative TEKRAM calculations and PAPER_ONLY invariants.
- `core/companion-integration.json` - signed, allowlisted Core-to-Companion dispatch contract.
- `agents/` - agent definitions.
- `mcp/` - MCP connector definitions.
- `docs/` - architecture and operating notes.

## Current interface

ChatGPT is the primary interface. Veridan Core is the system layer. Agents are the executors. MCP servers are the bridges to tools and services.

## Safety rule for trading

Trading-related agents may analyze, prepare, and explain trades in `PAPER_ONLY` mode. Live broker connection, live order execution, and money movement are disabled by the core contract.

## Core verification

```bash
npm run test:core
npm run veridan:doctor
```

`veridan doctor` checks registry references, route integrity, safety invariants, and the authoritative TEKRAM formula contract. A failed check exits non-zero.

## Windows Companion

Milestone 2 adds a separate Windows-local sensory service under `companion/windows/`. It provides signed, authenticated loopback health, heartbeat, active-window observation, one-shot `SEE`, and visible `WATCH` with local-only frame comparison.

```bash
npm run test:companion
npm run test:integration
```

The companion is non-executing: it cannot type, click, automate a browser, run arbitrary commands, place trades, or move money. See `companion/windows/README.md` for Windows installation and verification.

## Core-to-Companion integration

Milestone 3 connects exactly two routed capabilities to the Windows Companion:

```text
command -> deterministic route -> policy -> signed loopback request -> verification -> event metadata
```

- `screen.see` requests one fresh ephemeral frame.
- `screen.watch.prepare` requires direct user direction and starts only visible WATCH.
- Requests use bearer + HMAC-SHA256, a 30-second timestamp window, and one-use nonces.
- Screenshot bytes may be returned to the immediate caller but are never written to the Core event history.
- Arbitrary Companion paths, desktop execution, browser automation, and financial execution remain unavailable.

On the Windows host, run the real end-to-end check after reinstalling the Companion:

```powershell
powershell -ExecutionPolicy Bypass -File .\companion\windows\scripts\verify-core-integration.ps1
```

The existing Base44 function and external gateways are not allowed to consume this local sensory path. Any future integration must use structured registered capabilities, re-run policy server-side, and receive a separate review.
