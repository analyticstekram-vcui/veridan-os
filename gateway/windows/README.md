# Veridan Command Gateway

The local Command Desk is a loopback-only, read-only browser surface for source-backed Mind Vault retrieval. It does not expose the Mind Vault token to a browser and does not expose Companion controls, OpenClaw, trading, automation, or any write action.

Install after the Mind Vault bridge is healthy:

```powershell
cd "$HOME\veridan-os"
powershell -ExecutionPolicy Bypass -File .\gateway\windows\scripts\install.ps1
powershell -ExecutionPolicy Bypass -File .\gateway\windows\scripts\verify.ps1
```

Then open [http://127.0.0.1:4700/](http://127.0.0.1:4700/) on the same Windows computer. The service runs as a limited task for the current user and starts hidden at logon.

The existing remote Base44 interface is intentionally not pointed at this loopback service: a hosted browser page must not receive local bridge credentials or privileged desktop capabilities.
