# Jarvis Integration Milestone 1

## Outcome

The Jarvis architecture has been applied as a hardening pattern, not as a replacement application. Veridan now has a deterministic nervous-system contract connecting intent, agents, capabilities, policy, events, verification, connectors, and authoritative TEKRAM state.

## Implemented

1. **Deterministic router** — resolves known phrases to registered capabilities and denies unknown intent.
2. **Capability registry** — binds every action to one agent, risk level, operating mode, and verification list.
3. **Permission engine** — permits observation and preparation, gates modifications, and denies financial execution.
4. **Event catalog and local bus** — accepts only registered, schema-checked events and creates immutable envelopes.
5. **Agent registry** — defines TEKRAM, developer, memory, desktop sensory, research, and automation agents.
6. **Connector registry** — records the current boundary of GitHub, TradingView, TEKRAM paper API, Obsidian, OpenClaw, and the future Windows companion.
7. **TEKRAM contract** — locks EMA 2/25/200, MACD 2/25/12, SignalMirror, zero/signal cross meanings, zero-cross TP/SL reset, and PAPER_ONLY mode.
8. **Veridan Doctor** — verifies the contracts and fails non-zero when an invariant is broken.

## Deliberately not connected yet

The current Base44 `veridanApi` function uses an LLM to classify a command and can forward raw text to a fixed VPS backend. Milestone 1 does not modify that protected backend function. Before it can consume the new runtime, the handoff needs these controls:

- accept a structured capability envelope instead of raw command text;
- require a registered capability ID and agent ID;
- re-run policy server-side;
- remove the fixed HTTP backend address in favor of a server-side secret/configuration;
- use durable approval and audit storage instead of process memory;
- emit event records for received, routed, approved, executed, failed, and verified states;
- require executor-specific verification before returning `completed`.

## Next milestone

Build the Windows Companion as a separate local sensory service with heartbeat, fresh-frame `SEE`, visible/ephemeral `WATCH`, and a localhost authenticated transport. It should produce observations only. Veridan Core remains responsible for routing and policy, and external executors remain responsible for actions.

In parallel, adapt the existing Obsidian bridge to return source identifiers with every retrieval so the Memory Agent can satisfy the provenance rule.
