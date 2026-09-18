# Jarvis Astra Integration Map

## Purpose

This document maps the 16-prompt **Build Your Own Jarvis with GPT-6 Astra** pack onto the existing Veridan architecture. It is an integration plan, not a second Jarvis implementation.

Audit baseline:

- Repository: `analyticstekram-vcui/veridan-os`
- GitHub baseline inspected: `main` at `d3293e4b88fae9d72d8178eb9e19a18b3b8fa9e1`
- Integration branch: `docs/jarvis-astra-integration-map`
- Runtime code modified by this task: **none**
- Status meanings:
  - **BUILT** = the required behavior already exists in the remote repository with meaningful verification.
  - **PARTIAL** = Veridan already contains a usable primitive or adjacent implementation, but not the complete prompt behavior.
  - **MISSING** = the prompt behavior is not implemented in the remote repository.

This audit deliberately counts **remote GitHub evidence only**. A locally verified WebGL Galaxy commit discussed outside GitHub was not visible on the remote branch list or default-branch code search at audit time, so it is not counted as built here.

## Architectural rule

Do **not** create the prompt pack's parallel `server.py` / `viewer/` / `config.json` stack. Veridan already has a governed local architecture:

```text
Command Desk :4700
  -> Veridan Core router / policy / orchestrator
     -> Mind Vault bridge :57446
     -> Windows Companion :4701
```

Primary integration points are:

- `runtime/command-gateway.mjs`
- `runtime/orchestrator.mjs`
- `runtime/router.mjs`
- `runtime/companion-dispatcher.mjs`
- `runtime/doctor.mjs`
- `mind-vault/server.mjs`
- `companion/windows/`
- `core/*.json`
- `test/`
- existing live preflight scripts under `scripts/`, `gateway/windows/scripts/`, `mind-vault/windows/scripts/`, and `companion/windows/scripts/`

The existing safety model remains authoritative: fail closed, loopback-only local bridges, signed local requests, ephemeral sensory data, `READ_ONLY` by default, and `PAPER_ONLY` for trading.

---

## Prompt-by-prompt map

### Prompt 01 — The Foundation: Galaxy and Brain

**Status: PARTIAL**

**Already present**

- Mind Vault Markdown retrieval: `mind-vault/server.mjs`
- Signed local memory integration: `runtime/memory-client.mjs`, `runtime/memory-dispatcher.mjs`
- Natural-language local command surface: `runtime/command-gateway.mjs`
- Command route: `POST /v1/commands`
- Gateway health: `GET /health`
- Retrieval route behind Core: `GET /mind-vault/search`
- Source-backed answers with title/path/excerpt: `docs/JARVIS_INTEGRATION_MILESTONE_6.md`

**Missing from the prompt**

- No remotely visible 3D knowledge Galaxy on the audited GitHub baseline.
- No model-backed `/chat` endpoint.
- No server-side conversational history for note-grounded follow-ups.
- Current Mind Vault contract explicitly sets `external_model: false`.

**Conflict / adaptation**

The pack asks for a Python server that serves a browser-reachable viewer and reads an OpenAI key from project-root `config.json`. Veridan should **not** adopt that shape. Any future brain should be a Core capability behind the existing gateway/policy layer, with credentials server-side and never browser-reachable.

**Required tests**

- Unit/integration test for a new model-backed answer capability proving only verified Mind Vault sources are passed into the model.
- Test that unknown/unsupported source claims fail closed.
- Test that model credentials cannot appear in browser HTML, JSON responses, event history, or logs.
- Galaxy tests should verify graph node/source identity stability and no source-content persistence beyond allowed response paths.

**Live verification**

- Run Command Desk + Mind Vault live.
- Ask a question backed by a known note and prove source citation.
- If/when the Galaxy is merged remotely, prove the same source ID maps to the rendered node.
- If/when a brain is added, make one real minimal model call and prove source-bounded output.

---

### Prompt 02 — Speech: Voice Both Directions

**Status: PARTIAL**

**Already present**

- Browser speech recognition in `runtime/command-gateway.mjs` using `SpeechRecognition || webkitSpeechRecognition`.
- Browser speech synthesis using `speechSynthesis` and `SpeechSynthesisUtterance`.
- Voice settings and tests in `test/command-gateway.test.mjs`.
- Voice-input and voice-output work is already merged into `main`.

**Missing from the prompt**

- No named `FINISH_MS = 900` buffering contract.
- No explicit proof that mid-sentence pauses are merged before dispatch.
- No `?mute=1` global speech kill switch.
- No verified instant bypass for words such as "stop" / "wait".

**Conflict / adaptation**

Keep speech in the browser. Do not add a paid speech dependency unless explicitly chosen later. The browser privacy disclosure already exists and should remain.

**Required tests**

- Deterministic test for pause buffering and timer restart.
- Test instant interrupt-word bypass.
- Test `?mute=1` suppresses every speech path.
- Regression test that voice never sends audio bytes to Core.

**Live verification**

Speak one sentence with a deliberate pause longer than normal word spacing but shorter than `FINISH_MS`; verify one submitted command. Open a second `?mute=1` tab and verify silence.

---

### Prompt 03 — Demo Moment: Prove the Source

**Status: PARTIAL**

**Already present**

- `POST /v1/commands` returns source-backed answer metadata.
- The Command Desk renders the top source and related sources.
- Retrieval returns stable source IDs, vault-relative paths, titles, and excerpts.

**Missing from the prompt**

- No remotely visible Galaxy camera fly-to.
- No source-cluster lighting.
- No question classifier that explicitly controls camera movement.

**Conflict / adaptation**

The existing proof mechanism is stronger on provenance than the prompt's simple node-index array because Veridan uses stable source IDs and scoped paths. Preserve those identifiers; do not replace them with array indexes.

**Required tests**

- Source ID -> Galaxy node identity mapping.
- Single-source question moves to one node.
- Multi-source answer above threshold highlights a cluster without falsely privileging one source.
- Small talk never changes Galaxy camera state.

**Live verification**

Run one single-source query, one multi-source query, and one small-talk turn while recording Galaxy state before/after.

---

### Prompt 04 — Character: The Butler

**Status: PARTIAL**

**Already present**

- Command Desk has selectable response presentation behavior in `runtime/command-gateway.mjs`.
- Browser voice output is available.
- Recent merged work includes a Jarvis-style response surface.

**Missing from the prompt**

- No model-level butler persona block.
- No server-side system prompt because the current answer mode is source excerpt only.
- No dynamic boot greeting driven by graph-note count.
- No one-sentence wit policy.

**Conflict / adaptation**

Persona must never weaken provenance or safety. Factual content should remain source-backed; personality should be a presentation layer around verified facts, not a license to invent.

**Required tests**

- Persona output cannot fabricate a source.
- Unsupported questions still clearly report missing support.
- Greeting note count is computed, not hardcoded.
- Small talk does not trigger retrieval/Galaxy movement.

**Live verification**

Run supported, unsupported, and small-talk examples and inspect both spoken and displayed output.

---

### Prompt 05 — Growth: Total Recall

**Status: PARTIAL**

**Already present**

- Router recognizes capture intent through `memory.capture.prepare` in `core/router.json`.
- Capability registry contains `memory.capture.prepare` in `core/capability-registry.json`.
- Existing architecture explicitly separates approved writes from read-only retrieval.

**Missing from the prompt**

- No `POST /remember` route.
- Mind Vault bridge explicitly has `vault_write: false`.
- Command Desk does not expose memory writes.
- No live write + immediate indexing + live Galaxy node birth path.

**Conflict / adaptation**

Do **not** bypass the existing approval boundary. The correct Veridan version is:
`remember that` -> prepare draft -> explicit approval -> approved write -> immediate re-index/retrieval verification.

**Required tests**

- Unapproved capture cannot write.
- Approved write creates exactly one scoped Markdown file.
- New note is retrievable immediately after approved write.
- Event history stores identifiers/status, not full note text unless a separate approved retention rule exists.
- Duplicate capture is handled deterministically.

**Live verification**

Approve a harmless test capture, verify the file exists in the allowed vault location, then immediately retrieve it through Core.

---

### Prompt 06 — Sight: Eyes on the Screen

**Status: PARTIAL**

**Already present**

- Windows Companion has fresh ephemeral `SEE`: `POST /v1/see`.
- Core capability: `screen.see`.
- `runtime/companion-dispatcher.mjs` verifies fresh frame/source/ephemeral retention.
- Companion is loopback-only and signed.
- Screenshot bytes are not written into Core event history.

**Missing from the prompt**

- Command Desk intentionally does not expose Companion capabilities.
- No `POST /see` model-analysis route.
- No browser-held `getDisplayMedia` flow feeding a model question.
- Current SEE uses Companion PNG semantics, not the prompt's browser JPEG contract.

**Conflict / adaptation**

Keep the existing signed Companion sensor rather than duplicating it with a second capture path unless there is a clear UX requirement. If a vision model is added, it should consume a fresh ephemeral Companion frame through Core and preserve the no-persistence rule.

**Required tests**

- Frame freshness and source identity.
- Frame bytes absent from audit/event storage.
- Ended/unavailable sensor cannot reuse an old frame.
- Correct media type is sent to the selected model adapter.
- Model response explicitly fails on unusable imagery rather than guessing.

**Live verification**

Perform one real signed SEE through Core, then a live model vision request once that adapter exists.

---

### Prompt 07 — Preflight

**Status: PARTIAL**

**Already present**

- Contract/safety doctor: `runtime/doctor.mjs`.
- Command Gateway live preflight: `scripts/veridan-command-gateway-preflight.mjs`.
- Mind Vault live verification: `mind-vault/windows/scripts/verify-core-retrieval.ps1`.
- Companion live verification: `companion/windows/scripts/verify.ps1`.
- Core + Companion live verification: `companion/windows/scripts/verify-core-integration.ps1`.
- Gateway Windows verification: `gateway/windows/scripts/verify.ps1`.

**Missing from the prompt**

- No single unified end-to-end harness covering every active Jarvis organ.
- No real API-key/model reachability checks because the current governed retrieval path uses no external model.
- No live recall-write test because writes are intentionally not exposed.
- No served-file-vs-disk stale asset check covering the Galaxy.
- No single `N pass, N fail, N warn` result spanning the whole Jarvis surface.

**Conflict / adaptation**

Extend the existing doctor/preflight system; do not replace it with a standalone Python harness.

**Required tests**

Create a top-level live preflight that composes existing verifiers and later adds Galaxy, speech, vision, approved-memory-write, focus, and model checks.

**Live verification**

One command should produce an aggregate nonzero-on-failure result from the actual running local services.

---

### Prompt 08 — Brain Swap

**Status: MISSING**

**Already present**

- Some repository surfaces can display model status, but there is no governed runtime brain-swap implementation for Command Desk.

**Missing from the prompt**

- No `POST /model`.
- No runtime current-brain state.
- No spoken-name model alias map.
- No explicit real-model allowlist.
- No restart-to-configured-default behavior.
- No OpenRouter model router in the local governed runtime.

**Conflict / adaptation**

A model router must be explicit and fail closed. It should live behind a Core capability and policy contract. Never use fuzzy version matching.

**Required tests**

- Exact alias -> exact model ID.
- Unknown family/version is rejected.
- Restart restores configured default.
- Credentials never reach browser code or audit history.
- Every model route is bounded to allowed capabilities.

**Live verification**

Swap to one known model, reject one nonexistent version, restart, and prove the default is restored.

---

### Prompt 09 — Accountability: Focus Sessions

**Status: MISSING**

**Useful existing primitives**

- Companion can report a fresh active window via `GET /v1/active-window`.
- Companion already enforces local-only observation and no hidden monitoring.

**Missing from the prompt**

- No server-owned focus session timer.
- No app/tab target lock.
- No per-tick focus engine.
- No drift grace/callouts/snooze/excuse/pause/resume/extend/abort.
- No focus ledger or desktop countdown card.

**Conflict / adaptation**

Any focus feature must preserve the Companion privacy model. Raw app/tab identity should not enter persistent Core history. Browser tab observation would require an explicit new bounded sensor contract; it should not be inferred from unrelated browser automation code.

**Required tests**

- Session survives UI reload.
- No app/tab identity leaks through client state or persisted ledger.
- Drift timing is deterministic under controlled clocks.
- Home-base behavior is explicit.
- Watch/active-window sensors cannot start invisibly.

**Live verification**

Start a session, move off target, return, finish, and verify aggregate-only report data.

---

### Prompt 10 — Deferred Lock

**Status: MISSING**

**Dependency**

Prompt 09 must exist first.

**Missing**

- Deferred-target state.
- Two-consecutive-tick settle logic.
- Jarvis-home detection for target acquisition.
- 45-second app-only fallback.
- One-answer intent capture window.

**Conflict / adaptation**

Do not guess a target from background windows. A wrong lock should fail open into a clearly deferred state rather than silently selecting a surface.

**Required tests**

- Start from Jarvis home -> deferred.
- First stable non-home surface becomes target after required settle count.
- Never settles from a background identity.
- Fallback occurs only after the configured timeout.
- Debug state exposes booleans/counters, not identities.

**Live verification**

Use the exact click-start -> switch-to-work -> lock -> drift flow.

---

### Prompt 11 — Re-target: Lock This Tab

**Status: MISSING**

**Dependency**

Prompts 09 and 10.

**Missing**

- Voice re-target commands.
- Desktop-card re-target control.
- Self-overlay/frontmost-app trap handling.
- Browser-front-window direct read path.

**Conflict / adaptation**

This requires a new explicit browser-surface sensing contract. Existing Companion boundaries prohibit browser automation, so reading browser front-window/tab identity must be designed as a narrow observation capability, not smuggled through general automation.

**Required tests**

- Work-tab re-target.
- Home-tab re-arm deferred target.
- Non-browser app target.
- Overlay/card-origin request cannot lock the overlay itself.

**Live verification**

Verify from a work browser surface, Jarvis home, and desktop card.

---

### Prompt 12 — Name the Distraction

**Status: MISSING**

**Dependency**

Prompt 09 focus drift identity must exist ephemerally.

**Missing**

- Host/app label mapping.
- Escalating named line pools.
- One-tick-only distraction label.
- Privacy proof that labels are absent from state, ledger, event history, and notes.

**Conflict / adaptation**

This prompt aligns with Veridan's existing privacy philosophy: ephemeral observation, whitelisted persistence. Preserve that pattern.

**Required tests**

Use a synthetic unique distraction label and prove it is absent from every persistent output after a drift callout.

**Live verification**

Mapped site, unmapped site, and desktop app; inspect spoken line and persisted data.

---

### Prompt 13 — Camera Eyes

**Status: MISSING**

**Already present**

No webcam/pose implementation was found in the governed runtime.

**Missing**

- Local face/pose landmark pipeline.
- Presence/head-down/slouch booleans.
- Focus-session posture integration.
- One-frame webcam question path.
- Relief valve.
- "Organs may not turn the mic on" enforcement across camera features.

**Conflict / adaptation**

Camera frames should remain local unless the user explicitly asks a visual question. Persist only bounded booleans/counters; never raw frames.

**Required tests**

- Local-only posture inference path.
- No frame persistence.
- Relief valve suppresses nudges for configured duration.
- Camera organ cannot activate microphone.
- Background `?mute=1` remains silent once Prompt 02 completes.

**Live verification**

Trigger a posture event, then relief mode, and prove silence.

---

### Prompt 14 — Screen Watch

**Status: PARTIAL**

**Already present**

- Companion WATCH: `POST /v1/watch/start`, `POST /v1/watch/stop`.
- Local frame-difference processing.
- Visible topmost WATCH indicator.
- Direct user direction required through `screen.watch.prepare`.
- No screenshot persistence.

**Missing from the prompt**

- No 5-second thumbnail cadence contract matching the pack.
- No 60-second stillness timer that calls a model once.
- No three-minute model-nudge cooldown.
- No shared frame path for user questions while WATCH is active.
- No entire-screen-vs-tab-share detection because Veridan WATCH is Companion-based, not browser `getDisplayMedia`.
- No assistant-face desktop card.

**Conflict / adaptation**

Reuse the existing WATCH sensor and visible indicator. Add a higher-level Core "stare" state machine rather than creating a second independent screen watcher.

**Required tests**

- Local diff only until threshold.
- Exactly one model call after stillness threshold.
- Cooldown suppresses repeated calls.
- User-directed screen question can request a fresh frame without creating a second watcher.
- WATCH identity/frames never persist.

**Live verification**

Start WATCH, hold the display still through threshold, receive one nudge, then ask about the current screen.

---

### Prompt 15 — Brain Swap Personality Lines

**Status: MISSING**

**Dependency**

Prompt 08.

**Missing**

- Curated model-intro line pools.
- Single brain-swap function across all control paths.
- Pretty-name formatting.
- Pinned aliases.

**Conflict / adaptation**

Curated lines are presentation only. They must not alter the model allowlist or imply a model loaded when the verified swap failed.

**Required tests**

- Every swap path calls one shared verified function.
- Rotation avoids immediate repetition.
- Failed swap emits no success/personality line.
- Pretty-name formatting never changes the underlying verified model ID.

**Live verification**

Swap by two different control paths and confirm two distinct lines for the same verified model.

---

### Prompt 16 — Field Proof

**Status: PARTIAL**

**Already present**

- `runtime/doctor.mjs` validates core contracts and safety invariants.
- Companion `GET /last-error`.
- Health endpoints for Gateway, Mind Vault, and Companion.
- Multiple live Windows preflight scripts.
- Existing architecture already emphasizes signed live checks rather than mocks only.

**Missing from the prompt**

- No `GET /focus/diag`.
- No `?focusdebug=1` overlay.
- No aggregate-only focus ledger.
- No `?focusprobe=1` browser probe page.
- No asserted-viewport focus probe.
- No unified "probe + preflight" summary for focus organs.

**Conflict / adaptation**

Build diagnostics before implementing focus behavior, but fit them into the current doctor/health/preflight structure. Diagnostic outputs must be whitelist-based and identity-free.

**Required tests**

- Schema/whitelist test for every diagnostic response.
- Ledger rejects any non-approved key.
- Probe output is machine-readable and deterministic.
- Long-lived running process is queried; diagnostics cannot silently substitute a fresh process.

**Live verification**

Run live diagnostics against the actual running Gateway/Core/Companion stack, then run the browser probe and aggregate preflight.

---

## Summary

| Prompt | Capability | Status |
|---|---|---|
| 01 | Galaxy + brain | PARTIAL |
| 02 | Voice | PARTIAL |
| 03 | Source fly-to / demo proof | PARTIAL |
| 04 | Butler persona | PARTIAL |
| 05 | Total Recall / memory write | PARTIAL |
| 06 | Screen sight | PARTIAL |
| 07 | Preflight | PARTIAL |
| 08 | Brain swap | MISSING |
| 09 | Focus sessions | MISSING |
| 10 | Deferred lock | MISSING |
| 11 | Re-target | MISSING |
| 12 | Name distraction | MISSING |
| 13 | Camera eyes | MISSING |
| 14 | Screen watch / stare | PARTIAL |
| 15 | Brain-swap personality | MISSING |
| 16 | Field diagnostics | PARTIAL |

No prompt is marked fully **BUILT** because the pack defines end-to-end behaviors, while the current remote Veridan repository intentionally implements narrower, governed primitives. That is not a reason to rebuild them. It is the reason to integrate against them.

## Recommended implementation order

The next implementation should follow dependency order while preserving the existing architecture:

1. **Remote Galaxy reconciliation** — get the already-verified WebGL Galaxy work onto a remote branch and make its source identity use Mind Vault source IDs.
2. **Unified live preflight** — extend existing diagnostics before adding more organs.
3. **Speech reliability completion** — finish buffering, interrupts, and `?mute=1`.
4. **Vision brain adapter** — connect fresh `screen.see` frames to a governed model capability.
5. **Grounded brain capability** — add model-backed note answers without replacing deterministic retrieval.
6. **Approved Total Recall** — connect `memory.capture.prepare` to the existing approval/write path and immediate retrieval proof.
7. **Brain swap** — exact allowlisted model routing only.
8. **Focus diagnostics contract** — define identity-free diag/ledger/probe surfaces before focus behavior.
9. **Focus sessions + deferred lock + re-target + distraction naming**.
10. **Camera eyes**.
11. **Screen-stare model nudge** using the existing WATCH sensor.
12. **Curated brain-swap personality lines**.

## Non-negotiable Veridan constraints

- No parallel Jarvis server.
- No credentials in browser code, repository files, model prompts, or audit history.
- No hidden monitoring.
- No frame persistence by default.
- No arbitrary shell/keyboard/mouse/browser execution through Companion.
- No live trading or money movement.
- Unknown capabilities and unknown model versions fail closed.
- Memory writes remain approval-gated.
- Every new organ gets contract tests plus a live verification path before it is called complete.
