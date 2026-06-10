# ADR-011: One per-user journey ledger as the cross-skill source of truth

**Date:** 2026-05-28
**Status:** accepted

## Context

A user's tax refund is a long, multi-stage process — collect documents, calculate the refund, file the return, follow up — spread across many separate skill runs and conversations. Each run currently starts cold: rerunning `get-doc` doesn't know that the IDF discharge certificate was already requested last week and is waiting on an emailed PDF, or what's still outstanding. Worse, the work is splitting across skills (collection today; calculation and filing later), and none of them share a place to record "where did we stop, what do we have, what's left."

The detailed per-document research and playbooks already live in `Collector/documents/<slug>.md`. What's missing is a small, durable, **cross-skill** record of the user's *current standing*.

## Decision

There is **one per-user journey ledger**: a light, human-readable markdown file that is the single source of truth for where a user stands across the whole refund process. Every skill reads it at run start and updates it at run end.

- **Location (instance data):** the per-user memory dir, at `<memory>/journey.md`, where `<memory>` is `~/.claude/projects/<project>/memory/`. It is **not** committed to the shared repo — it is personal to one user and reveals their tax situation. Repo holds the *contract* (this ADR); memory holds the *data*.
- **Shape:** a `## Stages` table (collect → calculate → file → future stages, each with Status + Next action) and an accrete-as-you-go `## Documents` table (one row per doc, added on first touch). Documents columns: `Doc (slug) | Status | Updated | File | Next action | ETA | Reminder ID`.
- **Status state machine** per item: `todo → requested → have`, with `blocked` and `n/a` as side states. `requested` (submitted, awaiting async delivery such as an emailed PDF) is what captures "where we stopped" for async documents.
- **ETA + Reminder ID** capture the wait. When a doc flips to `requested`, the owning skill computes `ETA = today + 2 Israeli business days` (Sun–Thu workdays; skip Fri+Sat) and creates an Apple Reminder due 10:00 on that date. `ETA` is the ISO date; `Reminder ID` is the id returned by the AppleScript. Both clear when the doc transitions out of `requested`.
- **Cohort reminders.** All `requested` rows sharing the same `ETA` share **one** Apple Reminder (and therefore one `Reminder ID`). The reminder's title enumerates every doc in the cohort. Goal: if 5 docs are due the same day, the user gets 1 ping, not 5. See ADR-012 for the choice of Apple Reminders as substrate.
- **Single writer at a time.** v1 is interactive and single-session, so there is no real race; skills do a section-scoped read-modify-write and stamp `Last updated: <date> by <skill>`.
- **Accrete-as-you-go.** Rows appear the first time a doc is touched — the ledger is not pre-seeded with the full universe of possible documents.
- **No PII or credentials.** The ledger holds slugs, statuses, dates, file paths, and short next-action notes only. Reuse the get-doc sanitization table — never Israeli ת.ז., OTPs, names, addresses, or credentials. (Apple Reminder ids in the `Reminder ID` column are opaque AppleScript handles, not user identity — fine to store.)

## Why

Externalized durable state with checkpoint-resume is the only way a multi-run, multi-skill process can resume coherently instead of re-deriving its position every time. A single human-readable ledger keeps the user able to eyeball and correct it, and gives future skills (calculate, file) a known contract to plug into rather than each inventing its own state store. Keeping the instance data out of the shared repo follows the same trust boundary as ADR-001 — personal data stays on the user's machine.

## Alternatives considered

- **Per-skill private state files.** Rejected — calculation and filing need to know what was collected; siloed state forces each skill to re-discover the others' progress.
- **Store standing inside each `Collector/documents/<slug>.md`.** Rejected — that file is repo-shared general knowledge (ships to every user) and is doc-scoped, so it can't represent cross-stage standing or stay personal.
- **Use the typed auto-memory system (MEMORY.md entries).** Rejected — auto-memory is for stable facts/preferences, not a fast-mutating status table; the ledger is a living data file referenced *from* MEMORY.md, not a typed memory.
- **A real database / structured store.** Rejected for v1 — one user, one machine; markdown is inspectable and zero-infrastructure. Revisit if multi-user.

## Consequences

- Easier: any skill can answer "where are we?" and resume; the user gets a no-arg `/get-doc` that reports standing and proposes the next step.
- Easier: new stages (calculate, file) plug into the same `Stages` table without a new mechanism.
- Harder: every skill that changes user standing must remember to read at start and update at end, and must respect the single-writer + sanitization rules.
- Tradeoff: the ledger is per-machine and not version-controlled. Acceptable for v1 (single user). Multi-user or multi-device sync is a future concern.

## Related

- [ADR-001](ADR-001-no-credential-proxy.md) — same trust boundary: personal/credential data never leaves the user's control. The ledger keeps instance data off the shared repo for the same reason.
- [ADR-010](ADR-010-explain-and-gate-scary-actions.md) — legible actions; the ledger makes the *process* legible across runs, complementing per-action legibility.
- [ADR-012](ADR-012-apple-reminders-for-pending-docs.md) — Apple Reminders as the substrate for `requested`-doc reminders, and the cohort-bundling rule.
- `get-doc` skill (`.claude/skills/get-doc/`) — the first consumer / reference implementation of this contract.
