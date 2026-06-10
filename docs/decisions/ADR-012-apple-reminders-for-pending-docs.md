# ADR-012: Apple Reminders as the substrate for `requested`-doc reminders

**Date:** 2026-06-10
**Status:** accepted

## Context

Some tax-refund documents take days to arrive — most commonly the council residency certificate, which requires emailing a clerk and waiting for a reply. Today, when a doc flips to `requested` in the journey ledger, the user is on their own to remember to come back days later and re-run `/robintax`. We have a confirmed case where Yam waited an unknown number of days for the Ramat HaNegev cert because nothing pinged him.

We need a reminder mechanism that:

1. **Reaches the user when Claude Code is closed.** A reminder that only fires if the user happens to re-open Claude is not a reminder.
2. **Stands up zero new infrastructure.** No daemon, no cron we have to maintain, no remote service.
3. **Bundles** — if 5 docs are due the same day, the user gets 1 alert, not 5.
4. **Is announced up-front** — the user is told "I'm setting an Apple Reminder for Sun 2026-06-14" before it happens, so they aren't surprised.

## Decision

Use macOS Apple Reminders, driven via `osascript`, as the reminder substrate for any doc the ledger holds in `requested` status.

- On flip to `requested`: skill computes `ETA = today + 2 Israeli business days` (skip Fri+Sat) and creates an Apple Reminder due 10:00 local on that date. Capture the returned `id` and write it into the ledger row's `Reminder ID` column.
- **Cohort by ETA:** if another `requested` row already has the same `ETA`, **reuse** its `Reminder ID` instead of creating a new reminder, and rewrite the existing reminder's title to enumerate all docs in the cohort.
- On resolve to `have` (or on a re-stamp that moves the ETA forward): if other cohort members remain, rewrite the cohort reminder's title to drop the resolved doc; if this was the last, mark the reminder completed by id.
- On `/robintax` resume: detect cohorts whose ETA has passed **or** whose Apple Reminder the user manually completed, and auto-route to `/get-doc` re-check for every doc in the cohort before printing the standing report. Re-checking the user's own doc is not a scary action and never gates per ADR-010.
- **Announce the reminder.** Whenever a reminder is created, updated, or completed, the user gets one short line — e.g. `Setting an Apple Reminder for Sun 2026-06-14 10:00 — I'll ping you to re-check אישור תושב.` Never silent.

## Why

Apple Reminders is the only mechanism in reach that **actually surfaces an alert to the user when Claude Code is closed** without standing up new infra. The OS handles delivery on Mac and syncs to iPhone if iCloud is on. `osascript` is built in. We tested it end-to-end with a 60-second fake reminder before adopting.

Cohorting addresses a real likely failure: a user with 5 slow docs would otherwise get 5 simultaneous notifications, treat them as noise, and dismiss them all.

The 2-Israeli-business-day delay is uniform across doc types per user judgment — even for portal-poll docs like IDF discharge that often resolve in minutes, the 2-day reminder is a safe upper bound and avoids per-doc tuning.

## Alternatives considered

- **`schedule` / `CronCreate` skill / `ScheduleWakeup`.** Rejected — these fire inside Claude. The user must already have Claude Code open at the scheduled time for it to surface anything. Defeats the goal.
- **Google Calendar via the authorized MCP.** Rejected for v1 — works fine for users on Google Calendar but adds a network dependency and a second auth path. Apple Reminders + iCloud is local and zero-config for a macOS user. Revisit if we ship for non-Mac users.
- **Email to self.** Rejected — adds inbox noise, conflicts with the project's "no spam" principle.
- **macOS notification only (`osascript display notification`).** Rejected — fires once and gone. No way to re-surface if the user is away from their Mac at that moment. Reminders persists until acted on.
- **Per-doc ETA constants in each playbook.** Rejected — adds tuning surface for marginal benefit. The 2-business-day floor is good enough and uniform is simpler.
- **One reminder per doc (no cohorting).** Rejected — alert fatigue. 5 simultaneous notifications get dismissed as one.

## Consequences

- Easier: the user can close Claude, go about their week, and get a real OS-level ping to come back.
- Easier: the ledger now carries an authoritative `ETA` field, which feeds the `robintax` end-of-session wrap-up ("your Mac will ping you on Sun 2026-06-14").
- Harder: every skill that writes a `requested` row must also compute ETA, manage cohorts, and call osascript. Lives in `get-doc` for now (only writer of doc rows per ADR-011).
- Tradeoff: macOS-only. Linux/Windows users get the wrap-up but no reminder. Acceptable for v1 — current user is on macOS.
- Tradeoff: depends on iCloud Reminders being signed in. We checked Yam's setup works; failure mode for a future user is silent (osascript succeeds but no notification fires). Future hardening: probe `Reminders.app` availability on first use and warn if alerts seem disabled.

## Related

- [ADR-011](ADR-011-user-journey-ledger.md) — ledger schema, including the `ETA` and `Reminder ID` columns this ADR feeds.
- [ADR-010](ADR-010-explain-and-gate-scary-actions.md) — explain + gate. Creating a reminder is announced up-front but does not gate (it's not external/irreversible).
- `get-doc` skill — the writer that creates/updates/completes the reminders.
- `robintax` skill — the reader that uses ETA + Reminder ID for the wrap-up and resume-time auto-recheck.
