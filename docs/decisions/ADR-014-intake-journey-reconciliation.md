# ADR-014: Intake↔journey reconciliation — no orphaned expectations

**Date:** 2026-06-27
**Status:** accepted

## Context

Intake ([ADR-013](ADR-013-user-profile-and-intake.md)) is where the user declares everything that might matter for their refund. Each selection becomes an **expectation**: a document to collect, a credit to compute, or both. Those expectations flow into the journey ledger ([ADR-011](ADR-011-user-journey-ledger.md)) as `todo` document rows and into the profile's `## Eligibility branches`.

Nothing today guarantees each declared expectation reaches a conclusion. A user checks `תרמתי לעמותה` but the donation receipt is never gathered; checks `soldier` but the discharge certificate sits `requested` forever. The refund silently comes out lower than the user expected, and **nobody tells them** — the selection "fell between the chairs" (נפל בין הכיסאות). For a product whose whole promise is "get back everything you're owed," a silently-dropped credit is the worst failure mode: invisible, costs the user money, erodes trust.

The first canonicalized rule to hit this — `tax-rule/donations-46.md` — hand-rolled its own "if checked but no receipt found, flag it" note. That doesn't scale: every promoted rule would re-invent the same check, and some would forget.

## Decision

**Intake is a closed expectation set, and every expectation must reach a terminal state by the pre-file gate — or be surfaced to the user as an orphan. Never silently dropped.**

- **Terminal states (per intake-selected branch).** A branch is *reconciled* iff it is:
  - `applied` — a credit/deduction was computed for it, or
  - `dismissed` — confirmed not applicable, **with a one-line reason**, or
  - backed by a document in ledger state `have` or `n/a` (per ADR-011's doc state machine).

  A branch whose implied document is still `todo` / `requested` / `blocked` at pre-file, or whose branch was never `applied` **nor** explicitly `dismissed`, is an **orphan**.

- **The reconciliation check runs at two points:**
  1. `robintax` on resume — **informational**: "still outstanding from what you told us: X, Y."
  2. `calc-refund`'s pre-file gate — **blocking**: filing cannot proceed while silent orphans exist. Per [ADR-010](ADR-010-explain-and-gate-scary-actions.md), each orphan is shown explain-and-choose: name what the user declared, what's missing, and the refund impact, then offer **collect / dismiss-with-reason / proceed-anyway**.

- **Mechanically**, the check diffs the profile's `## Eligibility branches` (the intake selections) against the ledger's `## Documents` states plus calc's applied/dismissed branches, keyed by slug. The diff is generic — it does not know about any specific rule.

- **Specs declare expectations; they do not implement reconciliation.** A `tax-rule/<slug>.md` spec's only duty is to make its seeds explicit in `§ Intake § Seeds` (which doc, under which branch state, and the `n/a` conditions) so the diff can see them. The check itself is owned by `robintax` + `calc-refund`. Every current and future rule inherits orphan-protection for free.

## Why

The intake selection is a **promise** the user made visible to the system; reconciliation is the system keeping that promise or explaining why it can't. Centralizing the closure invariant — rather than letting each rule spec hand-roll a flag — means orphan-protection is universal and impossible to forget when a new rule is promoted. Gating it at the pre-file moment (not just an advisory on resume) puts the check where the cost of a miss is highest: once filed, a dropped credit needs a retroactive amendment to recover.

## Alternatives considered

- **Per-spec bespoke flags** (donations-46's first cut) — rejected: doesn't scale; each rule re-invents the same logic and some will forget, which silently reintroduces the failure mode.
- **Rely on the ledger's existing `blocked` / `n/a` states alone** — rejected: those track per-document *collection* status, not whether an intake *intent* was honored end-to-end. A branch can need no document yet still be dropped, and a doc can be `n/a` for the wrong reason.
- **Advisory-only (robintax resume), no pre-file block** — rejected: the moment that matters most is filing; an advisory the user scrolled past doesn't protect them.

## Consequences

- Easier: every promoted rule gets orphan-protection for free; the user can trust that "I told them X" won't silently vanish.
- Easier: gives `calc-refund` a concrete pre-file checklist derived directly from intake.
- Harder: `robintax` + `calc-refund` must implement and maintain the slug-keyed diff; the profile's eligibility branches and the ledger must stay queryable so the diff is mechanical.
- Tradeoff: introduces a `dismissed`-with-reason terminal state someone (skill or user) must set — a branch that is genuinely irrelevant now needs an explicit dismissal, not just silence. Accepted: explicitness is the whole point.
- Not yet implemented — this ADR records the contract; `robintax` and `calc-refund` are the consumers that will build the check. `tax-rule/donations-46.md § Intake § Seeds` is the first declared instance.

## Related

- [ADR-011](ADR-011-user-journey-ledger.md) — the substrate; this ADR adds a closure invariant on top of the doc state machine and lifts it to the branch level.
- [ADR-013](ADR-013-user-profile-and-intake.md) — intake is the expectation set this reconciles against.
- [ADR-010](ADR-010-explain-and-gate-scary-actions.md) — the orphan flag is explain-and-choose; filing-with-orphans is gated.
- `tax-rule/donations-46.md` — first motivating instance; its `§ Intake § Seeds` reconciliation bullet is an instance of this rule.
