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

The first hardened core milestone is now implemented as local, deterministic contracts and a fail-closed runtime. It routes and authorizes capabilities, but it does not dispatch external actions.

## Core modules

- `core/router.json` - command routing rules.
- `core/agent-registry.json` - known agents and their capabilities.
- `core/mcp-registry.json` - known MCP servers and tool bridges.
- `core/system-manifest.json` - top-level system identity and operating principles.
- `core/capability-registry.json` - bounded operations, modes, risk levels, and verification requirements.
- `core/event-catalog.json` - events permitted on the Veridan event bus.
- `core/policy.json` - permission levels and non-bypassable denials.
- `core/tekram-contract.json` - authoritative TEKRAM calculations and PAPER_ONLY invariants.
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

Milestone 2 adds a separate Windows-local sensory service under `companion/windows/`. It provides authenticated loopback health, heartbeat, active-window observation, one-shot `SEE`, and visible `WATCH` with local-only frame comparison.

```bash
npm run test:companion
```

The companion is non-executing: it cannot type, click, automate a browser, run arbitrary commands, place trades, or move money. See `companion/windows/README.md` for Windows installation and verification.

## Integration boundary

The current runtime deliberately stops at a verified route decision:

```text
command -> deterministic route -> registered capability -> policy decision -> verification requirements
```

The existing Base44 function and external gateways are not yet allowed to consume this decision directly. That integration must replace raw-command forwarding with a signed, registered capability envelope and receive a separate review.
