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

Before Veridan Core consumes companion observations, add a signed or mutually authenticated transport contract and verify the complete Windows chain on the target Acer PC. The companion must pass live checks for tray visibility, heartbeat continuity, active-window accuracy, SEE cleanup, WATCH stop behavior, logon startup, and restart recovery.
