# Jarvis Integration Milestone 2

## Purpose

Milestone 2 introduces the Windows Companion as a separate sensory service. The companion reports fresh observations; Veridan Core remains responsible for routing and policy, and no execution capability is added.

## Delivered contract

```text
Windows sensors
  -> fixed PowerShell helpers
  -> authenticated loopback service
  -> structured observation envelope
  -> Veridan Core (future handoff)
```

The service supplies heartbeat, health, capabilities, last-error diagnostics, active-window observation, one-shot SEE, and visible WATCH with local frame-diff processing.

## Reliability choices

- The heartbeat owns a retained timer for the lifetime of the process.
- Task Scheduler is configured with no execution time limit and three restart attempts.
- Uncaught exceptions and rejected promises record diagnostics and trigger orderly shutdown.
- PowerShell sensors have fixed script paths, no shell interpolation, and timeouts.
- WATCH prevents overlapping screen samples.

## Privacy choices

- The service is loopback-only.
- Sensor routes require a strong bearer token protected by Windows DPAPI at rest.
- Browser-origin requests are rejected.
- SEE deletes its temporary file before responding.
- WATCH stores no frames and sends nothing automatically.
- WATCH cannot start without its visible indicator.

## Next integration gate

The target Acer PC passed the authenticated live preflight on 2026-09-15 before and after a Windows restart. Verified checks were health, heartbeat continuity, non-executing capabilities, active-window observation, ephemeral SEE, visible WATCH, WATCH stop, clean last-error state, and logon startup.

The reboot exposed background PowerShell consoles even though the service restarted correctly. The follow-up startup hardening hides the scheduled-task and tray-host consoles while deliberately keeping the WATCH indicator visible.

The first credential-rotating reinstall exposed that Task Scheduler could stop the PowerShell launcher without terminating its child Node listener. Recovery was verified on 2026-09-16. The installer now identifies the exact process bound to loopback port 4701, refuses to stop an unexpected process, terminates only the matching Companion entry point, verifies port release, and only then rotates the DPAPI-protected token.

Milestone 3 adds the signed Core client contract. Reinstall the Companion before the live Milestone 3 preflight so the listener enforces HMAC signatures, one-use nonces, and timestamp freshness. Confirm that only the tray icon is present while WATCH remains visibly indicated when active.
