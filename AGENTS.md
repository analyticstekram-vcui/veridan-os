# Codex operating guide

Veridan Core is the governed orchestration layer for the Tekram Analytics AI ecosystem. The repository is the authoritative technical source of truth.

Before substantial work, read [PROJECT_STATE.md](PROJECT_STATE.md). Before architectural changes, read [ARCHITECTURE.md](ARCHITECTURE.md). Before new milestone work, read [ROADMAP.md](ROADMAP.md). Use [docs/SYSTEM_MAP.md](docs/SYSTEM_MAP.md) and [docs/DECISIONS.md](docs/DECISIONS.md) for system boundaries and recorded decisions.

Inspect the current implementation before editing it. Preserve unrelated behavior, prefer incremental changes, and extend an existing subsystem instead of creating a duplicate. Run relevant tests before considering work complete.

Maintain the current safety posture: `READ_ONLY` by default; `PAPER_ONLY` for trading; live broker execution and money movement disabled; unknown capabilities denied. Never expose secrets or credentials, and distinguish repository implementation from live deployment state. Never describe anything as deployed or live without direct evidence.

Preserve Mind Vault authentication, fixed path restrictions, and read-only retrieval boundaries. Preserve Command Desk same-origin browser isolation from Mind Vault credentials. Preserve Windows Companion restrictions against typing, clicking, arbitrary command execution, hidden monitoring, trading, and money movement.

