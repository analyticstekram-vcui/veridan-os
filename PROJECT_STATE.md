# Project state

Last verified: September 18, 2026

## Repository state

- Repository: `analyticstekram-vcui/veridan-os`
- Default branch: `main`
- Current HEAD: `0194ed6cd19d814b25f554c3a1a98a7069787779`
- Current milestone: Jarvis Integration Milestone 6 — Retrieval Quality
- Current manifest state: `core_retrieval_quality_candidate`
- PRs #1 through #9 are merged; no open PRs were present at reconnaissance time.

## Safety posture

The repository declares `READ_ONLY` as the default mode, `PAPER_ONLY` for trading, disabled live broker execution and money movement, and deny-by-default handling for unknown capabilities. These contracts are in `core/system-manifest.json`, `core/policy.json`, and `core/tekram-contract.json`.

## Completed subsystems

- Deterministic routing, policy evaluation, contract loading, and doctor checks.
- Authenticated, loopback-only Windows Companion sensory service.
- Signed Core-to-Companion dispatch for ephemeral SEE and visible WATCH preparation.
- Authenticated, fixed-scope Mind Vault retrieval.
- Retrieval quality ranking with source-backed excerpts and citations.
- Sanitized append-only local Core event history with replay and deterministic duplicate handling.
- Loopback-only Command Desk restricted to `memory.search`.
- Limited current-user Windows task installers and static installer tests.

Evidence: `runtime/`, `companion/`, `mind-vault/`, `gateway/`, `core/`, `test/`, and `docs/JARVIS_INTEGRATION_MILESTONE_1.md` through `docs/JARVIS_INTEGRATION_MILESTONE_6.md`.

## Verification results

The repository checks run during reconnaissance passed:

- Core tests: 25 passed.
- Installer and integration tests: 9 passed.
- Veridan Doctor: 13 passed / 0 failed.

The live Windows Mind Vault verification passed from the clean `main` checkout. The install script passed, `verify-core-retrieval.ps1` passed, the official vault path `C:\Users\peter\OneDrive\Desktop\obsidians\veridans mind` existed, and the bridge health endpoint was `http://127.0.0.1:57446/health`. The verification passed `mind_vault_health`, `mind_vault_scope_read_only`, `core_memory_search`, and `source_text_not_event_persisted`. Live Windows Companion and Command Desk preflights were not run. Lint and Vite build were not run because `node_modules` was absent. PR #9 reports those checks as passing, but that is historical PR evidence.

## Current incomplete work

- Implement durable approval lifecycle and approval authority; Phase A event history is complete.
- Define migration from the older Base44 `veridanApi` path to the governed local runtime.
- Confirm current external MCP and VPS availability.
- Establish a current deployment verification path; `main` contains no `.github/workflows/` directory.
- Decide whether unmerged infrastructure and control-room branches remain active.

## Relevant unmerged branches

- `infra/vps-deployment` at `67cb657d`, documenting a mobile-first VPS operations plan.
- `control-room-extraction` at `5fbf50e`.
- `control-room-extraction-plan` at `5fbf50e`.

Feature and fix branches for PRs #1 through #9 remain on the remote as historical branch tips, but their work is merged into `main`.

## Architectural debt and verification gaps

The newer governed local runtime and the older Base44 `veridanApi` are not unified. `veridanApi` still contains LLM classification, a fixed VPS target, and in-memory request logging. The local event bus is also in-memory. Repository implementation does not prove live deployment, live connector availability, or current VPS health.

Historical deployment or bridge reports must remain historical unless a current runtime check proves them again.

