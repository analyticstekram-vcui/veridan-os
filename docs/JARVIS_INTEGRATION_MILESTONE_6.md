# Jarvis Integration Milestone 6 — Retrieval Quality

## Outcome

Mind Vault retrieval now prefers the source that actually matches the user’s words. Exact phrases receive the highest rank, followed by note filename/path matches and source titles. Trading vocabulary receives a bounded boost only for the fixed Trading folders.

For example, `What did we decide about zero cross?` now prioritizes `03 Trading/Zero Cross.md` over unrelated Governance notes that happen to contain generic words such as “cross” or “zero.”

## Source-backed answers

The Command Desk displays the top source’s verbatim excerpt, title, and scoped vault path, followed by related sources. It does not use an external model or invent a summary from unrelated notes.

## Safety invariants

- Read-only Markdown retrieval only.
- No external model or API.
- No Mind Vault writes.
- No Companion control, OpenClaw dispatch, browser automation, trading, broker, or banking access.
- Source text remains response-only; events retain source identifiers only.
