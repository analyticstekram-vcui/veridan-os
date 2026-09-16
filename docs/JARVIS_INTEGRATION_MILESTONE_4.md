# Jarvis Integration Milestone 4 — Mind Vault Retrieval

Milestone 4 connects Veridan Core's registered `memory.search` capability to a dedicated local Obsidian retrieval bridge.

`memory.search` follows a deterministic chain: Core routes the question, signs a loopback request, the bridge searches only fixed allowlisted Markdown roots, and Core returns short excerpts with a stable source ID and vault-relative source path. The `memory.retrieved` event includes only source IDs and count, never note text.

## Safety boundary

- Read-only retrieval only; Obsidian writes remain in the separate approval-gated capture workflow.
- No user-supplied filesystem path, full-note endpoint, CORS access, external API call, scheduler, OpenClaw dispatch, broker, or banking integration.
- A separate token and service keep Mind Vault access distinct from the Windows Companion sensory role.
- A query without verified sources fails closed instead of producing an unsupported answer.

## Windows verification

```powershell
cd "$HOME\veridan-os"
git switch main
git pull --ff-only origin main
powershell -ExecutionPolicy Bypass -File .\mind-vault\windows\scripts\install.ps1
powershell -ExecutionPolicy Bypass -File .\mind-vault\windows\scripts\verify-core-retrieval.ps1
```

Expected result: `Veridan Core + Mind Vault retrieval preflight passed.`
