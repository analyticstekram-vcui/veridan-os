# Veridan Mind Vault Bridge

This is a separate local-only service for source-cited Obsidian retrieval. It cannot control the desktop.

- Listens only on `127.0.0.1:57446` with a separate DPAPI-protected token and signed requests.
- Searches Markdown only under fixed, allowlisted folders of `%USERPROFILE%\OneDrive\Desktop\obsidians\veridans mind`.
- Returns at most five short cited excerpts; it has no note-path endpoint.
- Cannot write the vault, call external APIs, schedule work, invoke OpenClaw, or access trading/banking.

From the repository root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\mind-vault\windows\scripts\install.ps1
powershell -ExecutionPolicy Bypass -File .\mind-vault\windows\scripts\verify-core-retrieval.ps1
```

The existing Vault Agent dashboard-reports bridge remains unchanged. This service is only constrained `memory.search` retrieval.

Use a normal (non-Administrator) PowerShell window. The bridge task is limited to the signed-in user and starts hidden.
