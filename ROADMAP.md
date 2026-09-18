# Roadmap

This roadmap starts from the current repository state: Jarvis Integration Milestone 6 — Retrieval Quality. No deadlines are assigned.

## CURRENT

- Milestone 6 retrieval-quality contracts, ranking, source excerpts, and regression coverage are merged into `main`.
- Local Core, Mind Vault retrieval bridge, Command Desk, and Windows Companion implementations are present.
- Phase A sanitized durable Core event history is implemented through local append-only JSONL storage; durable approval authority remains separate.
- Repository safety contracts remain read-only by default and paper-only for trading.

## NEXT

1. Run the Companion and Command Desk live preflights on the target Windows machine.
2. Record current evidence for the local services and their task-scheduler state.
3. Verify the local Core JSONL audit path in the real Windows runtime.

## PLANNED

1. Implement durable Core approval lifecycle and approval authority on top of the persisted event boundary.
2. Define and implement a reviewed migration path from Base44 `veridanApi` to the governed Core runtime.
3. Reconcile or archive the unmerged infrastructure and control-room branches.
4. Establish a current deployment verification path for Base44 and any VPS-backed services.
5. Continue MCP and connector work only behind existing registry, policy, authentication, and verification boundaries.
6. Expand Command Desk capabilities only through explicit registered capabilities and tests.
7. Preserve trading as `PAPER_ONLY` until a future explicitly approved change.

## UNVERIFIED / REQUIRES DECISION

- Whether the VPS and OpenClaw endpoints referenced by the repository are currently live.
- Whether TradingView MCP relay infrastructure is deployed and reachable.
- Whether `infra/vps-deployment`, `control-room-extraction`, and `control-room-extraction-plan` are active plans or archival branches.
- The durable storage design for Core events and approvals.
- The final ownership and migration boundary between the hosted Base44 interface and the local governed runtime.

