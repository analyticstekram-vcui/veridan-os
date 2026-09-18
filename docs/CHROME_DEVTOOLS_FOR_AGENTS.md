# Chrome DevTools MCP for Veridan OS

This guide connects an MCP client such as Codex to a dedicated Chrome instance for inspecting the local Veridan Command Desk at `http://127.0.0.1:4700/`.

It does not add browser automation to Veridan, change Command Desk capabilities, or grant the browser access to Mind Vault credentials. The MCP server is an external debugging tool that observes the browser session selected for it.

## Official package and configuration

Chrome DevTools MCP is published by the Chrome DevTools team. The package is run with `npx`, so it does not need to be added to this repository's `package.json`:

```powershell
npx --yes chrome-devtools-mcp@latest --help
```

The command above was used to verify the current CLI. The official configuration documentation is:

- <https://developer.chrome.com/docs/devtools/agents/get-started/configuration>
- <https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/advanced-usage.md>

Add a server entry to the MCP client configuration used by Codex. On Windows, use a dedicated profile path and keep the server restricted to the local Command Desk when Chrome 149 or newer supports `--allowed-url-pattern`:

```json
{
  "mcpServers": {
    "veridan-chrome-devtools": {
      "command": "npx",
      "args": [
        "--yes",
        "chrome-devtools-mcp@latest",
        "--user-data-dir=C:\\Users\\<USER>\\AppData\\Local\\Veridan\\ChromeDevToolsMcp\\profile",
        "--allowed-url-pattern=http://127.0.0.1:4700/*",
        "--no-usage-statistics",
        "--no-performance-crux",
        "--redact-network-headers"
      ]
    }
  }
}
```

Replace `<USER>` with the Windows account name. Keep this profile separate from everyday Chrome. Do not point the MCP server at the normal Chrome profile.

For a disposable session, replace `--user-data-dir=...` with `--isolated`. The isolated profile is removed when Chrome closes. The explicit profile is useful when repeatedly testing the same local UI, but it must remain free of personal logins and credentials.

The server starts Chrome itself when Codex starts the MCP connection. No separate Chrome launch is required for this configuration. Restart or reload the MCP client after changing its configuration.

## Strict localhost verification

Start the local gateway from this repository in a separate PowerShell window:

```powershell
Set-Location "C:\Users\peter\OneDrive\Documents\veridan-os-live"
npm run gateway:start
```

Then ask the connected MCP client to:

1. list the open pages;
2. navigate to `http://127.0.0.1:4700/`;
3. inspect the DOM for the `READ ONLY — Mind Vault Search` badge, the command textarea, voice controls, response-style selector, recent-searches panel, and favorite-prompts panel;
4. inspect the console for JavaScript errors;
5. inspect network activity and confirm requests stay on `127.0.0.1:4700` and use the existing `POST /v1/commands` route;
6. test a safe memory question and confirm the source-backed answer and citations remain visible.

With the strict allowlist, navigation and subresources outside `http://127.0.0.1:4700/*` are blocked. If the installed Chrome version does not support `--allowed-url-pattern`, use the dedicated profile and manually keep the session on localhost; do not use the everyday profile.

## Optional public YouTube research

Only open a public YouTube page when it is explicitly requested. For a temporary research session, add an additional allowlist entry such as:

```text
--allowed-url-pattern=https://www.youtube.com/*
```

Do not sign in. Do not inspect account pages, cookies, credentials, private videos, uploads, comments, subscriptions, purchases, or other account actions. Remove the YouTube entry afterward or use `--isolated` so the session is discarded.

## Existing Chrome connection

The preferred setup launches the dedicated profile from the MCP client. If a manually started dedicated Chrome instance is required, close other Chrome instances first and run:

```powershell
$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$Profile = "$env:LOCALAPPDATA\Veridan\ChromeDevToolsMcp\manual-profile"
Start-Process -FilePath $Chrome -ArgumentList @(
  '--remote-debugging-port=9222',
  "--user-data-dir=$Profile",
  'http://127.0.0.1:4700/'
)
```

Configure the MCP server to connect to that instance instead of launching Chrome:

```json
{
  "mcpServers": {
    "veridan-chrome-devtools": {
      "command": "npx",
      "args": [
        "--yes",
        "chrome-devtools-mcp@latest",
        "--browser-url=http://127.0.0.1:9222",
        "--no-usage-statistics",
        "--no-performance-crux",
        "--redact-network-headers"
      ]
    }
  }
}
```

Remote debugging exposes control of every page in that Chrome instance to local processes. Use only the dedicated profile, keep it unauthenticated, and close it when testing ends. Never attach this configuration to an everyday profile.

Chrome 144 and newer can also request a connection to a running browser with `--autoConnect` after Remote Debugging is enabled at `chrome://inspect/#remote-debugging`. This mode inherits the selected profile's cookies and logged-in state, so it is not the default Veridan workflow.

## Codex usage boundaries for Veridan

Allowed:

- inspect the local Command Desk DOM, console, and localhost network requests;
- click local test controls and submit safe read-only memory questions;
- verify voice input/output UI state when browser permissions allow;
- inspect explicitly opened public YouTube pages for read-only research.

Forbidden:

- banking, brokerage, credit, email, private account, or authenticated pages;
- collecting passwords, cookies, session tokens, OAuth tokens, or credentials;
- saving browser profile data, credentials, or page secrets in the repository, logs, Mind Vault, or browser localStorage;
- uploads, deletes, comments, subscriptions, purchases, trades, money movement, or other account actions;
- changing Command Desk capabilities, adding browser automation, or bypassing Veridan's read-only and `PAPER_ONLY` boundaries.

If a page requires login, stop and let the owner sign in manually. Never paste credentials into chat or a terminal. Treat authenticated pages as sensitive even when they are open in the dedicated profile.

## What this setup does not change

This documentation adds no runtime capability, endpoint, connector, browser automation, trading path, or credential flow to Veridan OS. The Command Desk remains a loopback, same-origin, source-backed `memory.search` surface. Chrome DevTools MCP only observes and tests the browser session selected by the MCP client.
