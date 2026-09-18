# Architectural decisions

## Deterministic local routing

**Decision:** Use registered intent rules and capabilities in the local Core router instead of unrestricted LLM routing.

**Reason:** The repository requires explicit capability registration, policy evaluation, verification, and deny-by-default handling.

**Evidence:** `runtime/router.mjs`, `core/router.json`, `core/capability-registry.json`, `docs/JARVIS_INTEGRATION_MILESTONE_1.md`.

**Current status:** Implemented in the local runtime.

## Fail-closed policy

**Decision:** Unknown intent, unavailable capability, failed verification, and hard-denied actions do not complete.

**Reason:** The system manifest and policy contract require explicit permission and verified completion.

**Evidence:** `runtime/policy-engine.mjs`, `runtime/orchestrator.mjs`, `core/policy.json`.

**Current status:** Implemented and covered by tests.

## Read-only default and paper-only trading

**Decision:** Keep the default mode `READ_ONLY`, trading `PAPER_ONLY`, live broker execution disabled, and money movement disabled.

**Reason:** These are explicit system safety invariants.

**Evidence:** `core/system-manifest.json`, `core/tekram-contract.json`, `core/policy.json`.

**Current status:** Implemented and checked by Veridan Doctor.

## Authenticated localhost Mind Vault bridge

**Decision:** Retrieve Mind Vault content through an authenticated loopback bridge with fixed allowlisted Markdown roots.

**Reason:** The bridge needs source provenance while limiting access to approved local knowledge paths.

**Evidence:** `mind-vault/server.mjs`, `core/memory-integration.json`, `docs/JARVIS_INTEGRATION_MILESTONE_4.md`.

**Current status:** Implemented.

## No arbitrary Mind Vault paths or retrieval writes

**Decision:** Reject caller-supplied filesystem paths and keep retrieval read-only. Approved writes remain a separate workflow.

**Reason:** Retrieval must not become a general filesystem or mutation channel.

**Evidence:** `mind-vault/server.mjs`, `mind-vault/manifest.json`, `base44/functions/obsidianWriteApprovedDraft/entry.ts`.

**Current status:** Implemented.

## Browser isolation from Mind Vault credentials

**Decision:** Keep the Mind Vault token in the local launcher and server process; Command Desk browser requests carry no token.

**Reason:** A browser surface should not receive local bridge credentials.

**Evidence:** `runtime/command-gateway.mjs`, `gateway/windows/scripts/install.ps1`, `docs/JARVIS_INTEGRATION_MILESTONE_5.md`.

**Current status:** Implemented.

## Limited current-user Windows tasks

**Decision:** Install the Mind Vault bridge, Command Desk, and Companion as hidden, limited, current-user scheduled tasks with protected local tokens.

**Reason:** The services are local integrations and should not require broad privileges or expose credentials in browser code.

**Evidence:** `mind-vault/windows/scripts/install.ps1`, `gateway/windows/scripts/install.ps1`, `companion/windows/scripts/install.ps1`.

**Current status:** Implemented in installers; live task state remains unverified here.

## No arbitrary Windows Companion command execution

**Decision:** Restrict the Companion to bounded sensory observations and visible WATCH behavior.

**Reason:** The Companion is a sensory service, not a desktop or financial executor.

**Evidence:** `companion/windows/src/server.mjs`, `companion/windows/README.md`, `core/companion-integration.json`.

**Current status:** Implemented and tested.

## Source-backed excerpts instead of generated summaries

**Decision:** Command Desk answers display a verbatim top-source excerpt with title and scoped path, followed by related sources.

**Reason:** Retrieval must preserve provenance and avoid invented summaries from unrelated notes.

**Evidence:** `runtime/command-gateway.mjs`, `core/retrieval-quality-contract.json`, `docs/JARVIS_INTEGRATION_MILESTONE_6.md`.

**Current status:** Implemented.

## Retrieval ranking

**Decision:** Use `exact_phrase_path_title_domain_v1`, including filename fallback for generic headings and bounded Trading-folder boosts.

**Reason:** Exact user language and source location should outrank incidental generic term matches.

**Evidence:** `mind-vault/server.mjs`, `core/retrieval-quality-contract.json`, `test/core-memory-integration.test.mjs`.

**Current status:** Implemented in Milestone 6.

## Command Desk scope

**Decision:** Initially expose only the registered `memory.search` capability.

**Reason:** The local browser surface needs a narrow, verifiable capability boundary before any expansion.

**Evidence:** `runtime/command-gateway.mjs`, `gateway/manifest.json`, `core/command-gateway-integration.json`.

**Current status:** Implemented; expansion requires a new registered capability and verification contract.

## Sanitized local Core event history

**Decision:** Persist only allowlisted Core event projections to an append-only local JSONL audit file. Keep the EventBus in-memory when no store is supplied, and replay persisted records without notifying subscribers.

**Reason:** The local governed runtime needs restart-surviving audit history without coupling this stage to the unresolved Base44 migration or adding a database dependency. Persistence must not turn Mind Vault, Companion, browser, or credential data into an audit channel.

**Evidence:** `runtime/core-store.mjs`, `runtime/event-bus.mjs`, `scripts/veridan-command-gateway.mjs`, `test/core-store.test.mjs`.

**Current status:** Phase A implemented. Durable approval lifecycle and approval authority are intentionally not implemented.

