# Intake

Asks the user a short structured set of eligibility questions on first run, produces a sanitized per-user **profile** that drives which documents `Collector/` fetches and which rule branches `Calculator/` applies. The first stage of `/robintax`.

## Boundaries

- **Never** stores PII — no names, no ת.ז., no addresses, no amounts. Same sanitization as the journey ledger ([Repo ADR-011](../docs/decisions/ADR-011-user-journey-ledger.md)).
- **Never** fetches a document — that's `get-doc`. Intake only writes the profile and seeds `todo` rows.
- **Single writer** of `<memory>/profile.md`. Downstream skills (`get-doc`, `calc-refund`, `robintax`) read it; only `intake` writes it.

## Service map

- [`branches/`](branches/) — one markdown file per eligibility branch. Each declares its **gate question** (and answer values that open follow-ups), its **follow-up questions**, the **doc slugs** it requires, and the **calculator rule keys** it feeds. Adding a new branch = adding a markdown file; the `intake` skill is a generic walker.
- [`required-docs-matrix.md`](required-docs-matrix.md) — flat cross-reference `(year, branch) → [doc slugs]`. The other half of "what docs does this user need." Replaces the TODO at [`.claude/skills/robintax/SKILL.md:150-166`](../.claude/skills/robintax/SKILL.md).
- [`decisions/`](decisions/) — service-local ADRs.

The `intake` skill itself lives at [`../skills/intake/`](../skills/intake/) — it's repo-wide because `/robintax` routes to it from outside this service tree.

## Branch file shape

Every branch follows the same shape so the walker can iterate them:

```markdown
# <Branch name>

**Profile key:** `<key>`         — matches Calculator/rules/types.ts where possible
**Status:** v1 | v2-stub          — stubs are skipped by intake until promoted

## Gate
**Question:** "..."
**Options:** yes | no | unknown
**Open follow-ups on:** yes, unknown

## Follow-ups
(omit if none)
- key, question, options

## Seeds
- **Docs (when yes):** `<slug>`, `<slug>`
- **Docs (when unknown — pessimistic include):** `<slug>`
- **Calculator rule keys fed:** `<key>`
```

## Conventions

- **Hebrew tax jargon in parens.** Same rule as the `robintax` REPORT format — full English, Hebrew in parens, no slugs in user-facing questions.
- **Tri-state eligibility:** every gate is `yes / no / unknown`. `unknown` → pessimistic seed (fetch the proof, let the doc decide). See [Repo ADR-013](../docs/decisions/ADR-013-user-profile-and-intake.md).
- **Profile field names mirror `Calculator/rules/types.ts`** 1:1 where they exist. New keys live in the profile only.
- **Doc slugs must exist in `Collector/documents/`.** If a branch's required doc has no playbook yet, mark the branch `v2-stub` until the doc is added — don't seed slugs that `get-doc` can't fulfill.

## Available skills for this service

- `intake` (repo-wide, at [`../skills/intake/`](../skills/intake/)) — the conversation walker. Reads branch files, asks gates + follow-ups via `AskUserQuestion`, writes `<memory>/profile.md`, seeds `<memory>/journey.md`.

## Local decisions

None yet.

## Repo decisions this service must honor

- [Repo ADR-013](../docs/decisions/ADR-013-user-profile-and-intake.md) — profile contract; intake is the only writer.
- [Repo ADR-011](../docs/decisions/ADR-011-user-journey-ledger.md) — ledger sanitization rules apply to the profile too.
- [Repo ADR-010](../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — gate once at the top (the preamble); don't re-confirm each question.
