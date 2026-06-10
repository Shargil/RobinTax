# ADR-013: User profile + intake as the first journey stage

**Date:** 2026-06-10
**Status:** accepted

## Context

The journey ledger ([ADR-011](ADR-011-user-journey-ledger.md)) records *where the user stands* across stages but says nothing about *who the user is*. Yet every downstream stage needs that. `get-doc` can't tell whether to fetch the IDF cert without knowing if the user served; `calc-refund` can't apply soldier/immigrant/disability/donation rules without knowing which branches apply. Today both ask ad-hoc, the user can be deep into collection before discovering they didn't need a doc — or worse, miss a credit because no one ever asked.

`Calculator/rules/types.ts` already encodes typed rule shapes for every eligibility branch (soldier, immigrant, disability, degree, children, donations, pension/life-insurance, settlement). The data sink exists; nothing produces the data.

## Decision

Add a per-user **profile** as the second durable artifact (alongside the journey ledger), and a new **Intake** stage as the first row of the Stages table that produces it.

- **Location:** `<memory>/profile.md` (`<memory>` = `~/.claude/projects/<project>/memory/`). Sibling of `journey.md`. Personal, not committed.
- **Format:** human-readable sanitized markdown. Sections: `## Filing scope`, `## Household`, `## Eligibility branches`. One line per fact. No PII (no names, no ת.ז., no addresses, no amounts).
- **Single writer:** the `intake` skill is the only writer. `get-doc`, `calc-refund`, `robintax` are read-only consumers. Same single-writer rule as the ledger.
- **Profile field names mirror `Calculator/rules/types.ts` keys** 1:1 where possible, so feeding the calculator is a trivial mapping.
- **Tri-state values for eligibility branches:** `yes` / `no` / `unknown`. `unknown` reflects the intake promise — "say 'I don't know' and we'll try to fetch the proof anyway." Downstream behavior:
  - **Collector** seeds the proof doc as `todo` (pessimistic include — collection itself resolves the question).
  - **Calculator** does *not* count an `unknown` branch as a credit until a `have` doc confirms it.
- **Re-intake** is a full re-walk. Profile holds one current state; no history. Existing `have`-status docs in the ledger are preserved across re-intakes.
- **Intake stage in the journey ledger:** the `## Stages` table grows from `Collect → Calculate → File` to `Intake → Collect → Calculate → File`. `robintax`'s top-down PICK NEXT routes to whichever stage isn't `done`, so first-run users land on Intake and returning users skip straight to Collect with no special case.
- **Profile drives ledger seeding.** When intake completes, it seeds the `## Documents` table with the docs implied by the profile × `Intake/required-docs-matrix.md` × declared filing years. Replaces the accrete-as-you-go default for the docs intake knows about; accretion remains for surprise docs that show up later.

## Why

Two problems collapse into one fix: collection wastes the user's time on docs that don't apply, and calculation silently leaves credits on the table because no one ever asked the gating question. A durable profile produced upfront is the only place that question can be asked *once* and reused by every downstream stage. Keeping it as a sanitized markdown sibling of the ledger (not a typed schema, not a DB row) preserves the v1 invariants from [ADR-011](ADR-011-user-journey-ledger.md) — inspectable, correctable by the user, zero infrastructure.

The `unknown` tri-state is what makes the intake actually completable. A binary yes/no forces the user to guess about credits they barely know exist; `unknown` honors the preamble's promise and pushes the burden of proof onto the doc itself, which is the right oracle anyway.

## Alternatives considered

- **Ask inside each stage.** Rejected — the same question gets asked in two stages, the user has already collected (or skipped) the proof doc before calc gets to ask, and the answer isn't durable across runs.
- **Typed schema (TS struct / JSON).** Rejected for v1 — markdown is enough, the user can read and correct it, and there's no second consumer that needs strict types. Revisit if a non-Claude consumer ever needs the profile.
- **Profile as a section of `journey.md`.** Rejected — different lifecycle (profile changes rarely, ledger changes every run) and different writers; mixing them violates the single-writer rule per file.
- **Binary yes/no eligibility (no `unknown`).** Rejected — forces the user to declare on credits they don't understand, leading to silent under-claim. `unknown → pessimistic seed` is the actual UX promise.

## Consequences

- **Easier:** `get-doc` skips docs the profile rules out as `n/a`; `calc-refund` populates its typed rule inputs from one place; `robintax` can finally compute per-year readiness ([ADR-011](ADR-011-user-journey-ledger.md) TODO unblocks).
- **Easier:** adding a new eligibility branch is a markdown file in `Intake/branches/` — no skill changes.
- **Harder:** intake adds a step before the user gets anything fetched. Mitigated by batched `AskUserQuestion` panels (2–4 questions per round-trip) and a `"I don't know"` escape that prevents the user from getting stuck.
- **Tradeoff:** profile is per-machine and not version-controlled, same as the ledger. Acceptable for v1 (single user); revisit with multi-device.
- **Tradeoff:** intake and the required-docs matrix must stay in sync with the `Collector/documents/` catalog. Drift means intake seeds non-existent doc slugs. Owned by the intake service's local convention.

## Related

- [ADR-001](ADR-001-no-credential-proxy.md) — same trust boundary: profile stays out of the shared repo because it reveals personal facts.
- [ADR-010](ADR-010-explain-and-gate-scary-actions.md) — intake gates once at the top (the preamble), then runs the batch without per-question re-confirmation.
- [ADR-011](ADR-011-user-journey-ledger.md) — the ledger contract this extends. Intake is the new first stage; profile is the new sibling artifact.
- `intake` skill (`.claude/skills/intake/`) — sole writer.
- `Intake/` service — branch definitions and required-docs matrix.
