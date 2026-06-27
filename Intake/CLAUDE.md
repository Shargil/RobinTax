# Intake

Asks the user a flat eligibility checklist on first run, then batches every follow-up implied by the user's selections — producing a sanitized per-user **profile** that drives which documents `Collector/` fetches and which rule branches `Calculator/` applies. The first stage of `/robintax`.

## Boundaries

- **Never** stores PII — no names, no ת.ז., no addresses, no amounts. Same sanitization as the journey ledger ([Repo ADR-011](../docs/decisions/ADR-011-user-journey-ledger.md)).
- **Never** fetches a document — that's `get-doc`. Intake only writes the profile and seeds `todo` rows.
- **Single writer** of `<memory>/profile.md`. Downstream skills (`get-doc`, `calc-refund`, `robintax`) read it; only `intake` writes it.

## Service map

- [`checklist.md`](checklist.md) — the eligibility surface: one line per selectable item, with its Hebrew label, the `tax-rule/<slug>.md` spec it maps to (or `none` for v2-stubs), and any flags (`(disqualifier)`, `(free-text)`). The `intake` skill walker renders this as multi-select `AskUserQuestion` panels of 4 items each.
- [`required-docs-matrix.md`](required-docs-matrix.md) — flat cross-reference `(year, checklist-slug-state) → [doc slugs]`. The other half of "what docs does this user need." Replaces the TODO at [`.claude/skills/robintax/SKILL.md:150-166`](../.claude/skills/robintax/SKILL.md).
- [`decisions/`](decisions/) — service-local ADRs.

The `intake` skill itself lives at [`../skills/intake/`](../skills/intake/) — it's repo-wide because `/robintax` routes to it from outside this service tree. Follow-up questions for each checked item live in `tax-rule/<slug>.md § Intake`, **not** in this service tree.

## How the surface maps to questions

The walker treats the checklist as a flat list. For every selected slug:

- **Has a `tax-rule:` spec** → read `tax-rule/<slug>.md § Intake § Follow-ups` and queue them. Titles prefixed `{Category} {i}/{N}: ...`.
- **`tax-rule: none`** → record `yes` in the profile; ask no follow-ups (v2-stub).
- **`(disqualifier)`** → soft-gate via §5 DISQUALIFIERS in the walker; on confirm, short-circuit intake.
- **`(free-text)`** → one plain-message prompt at the end of the follow-up batch.

Adding a new selectable item = adding a line in [`checklist.md`](checklist.md). Promoting an item from v2-stub to live calc support = writing a `tax-rule/<slug>.md` spec (template at [`../tax-rule/SPEC-TEMPLATE.md`](../tax-rule/SPEC-TEMPLATE.md)) and flipping the line's `tax-rule: none` to `tax-rule: <slug>`.

## Conventions

- **Hebrew labels in `checklist.md`** match the user's intake screens verbatim (Hebrew-primary). Everywhere else (reports, profile, ledger) follows the `robintax` REPORT rule: full English with Hebrew tax jargon in parens.
- **Tri-state on follow-ups:** every gate-like follow-up is `yes / no / unknown`. `unknown` → pessimistic seed (fetch the proof, let the doc decide). See [Repo ADR-013](../docs/decisions/ADR-013-user-profile-and-intake.md).
- **Profile field names mirror `Calculator/rules/types.ts`** 1:1 where they exist. New keys live in the profile only.
- **Doc slugs must exist in `Collector/documents/`.** If a slug's required doc has no playbook yet, surface it as a manual step in §11 HANDOFF — don't seed slugs that `get-doc` can't fulfill.
- **No follow-ups invented in code.** The walker is generic; if a slug has no `tax-rule:` spec, there are no follow-ups — full stop.

## Available skills for this service

- `intake` (repo-wide, at [`../skills/intake/`](../skills/intake/)) — the conversation walker. Renders `checklist.md` as multi-select panels, runs the disqualifier soft-gate, batches follow-ups from `tax-rule/<slug>.md § Intake`, writes `<memory>/profile.md`, seeds `<memory>/journey.md`.

## Local decisions

None yet.

## Repo decisions this service must honor

- [Repo ADR-013](../docs/decisions/ADR-013-user-profile-and-intake.md) — profile contract; intake is the only writer.
- [Repo ADR-011](../docs/decisions/ADR-011-user-journey-ledger.md) — ledger sanitization rules apply to the profile too.
- [Repo ADR-010](../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — gate once at the top (the preamble); don't re-confirm each question.
