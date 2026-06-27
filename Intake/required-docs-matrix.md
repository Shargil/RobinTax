# Required-docs matrix

Cross-references `(filing-year, checklist-slug-state) → [doc slugs]`. The `intake` skill reads this after §7 FOLLOW-UPS to seed `<memory>/journey.md`'s `## Documents` table. `robintax`'s wrap-up reads it to bucket years into `ready` / `blocked` — replaces the `⚠ Not computed` placeholder in [`.claude/skills/robintax/SKILL.md`](../.claude/skills/robintax/SKILL.md).

## Rules

- Only doc slugs that exist as files in [`Collector/documents/`](../Collector/documents/) may appear here. Adding a slug here without a playbook means `get-doc` can't fulfill it.
- A row's `State` column is the **profile value** for the checklist slug (from `<memory>/profile.md` `## Eligibility branches`). `unknown` always seeds the doc (pessimistic include per [ADR-013](../docs/decisions/ADR-013-user-profile-and-intake.md)).
- "Per year" means the same doc slug seeds once per declared filing year, with `(year)` annotation on the ledger row.

## v1 matrix

| Slug            | State                               | Doc slug                               | Per year? | Notes |
|-----------------|-------------------------------------|----------------------------------------|-----------|-------|
| (universal)     | always                              | `form-106`                             | yes       | Every salaried year. Seed per declared year. |
| `married`       | selected                            | `form-106` (spouse)                    | yes       | Annotate ledger row `(spouse YYYY)`. Spouse income is asked as a follow-up; if `no income`, skip the spouse seed. |
| `soldier`       | `yes` or `unknown`                  | `idf-discharge-certificate`            | no (once) | Form 830 covers all years in the 36-month window. Seeding logic per `tax-rule/soldier-39a.md § Intake § Seeds`. |
| `settlement`    | `yes` or `unknown`                  | `residency-confirmation-section-11`    | yes       | Council issues one per claimed year. |
| `immigrant`     | `yes` or `unknown`                  | *(see note)* `immigrant-certificate`   | no (once) | **Playbook not yet written** — surface as manual step in §11 HANDOFF. |
| `donations`     | `yes` or `unknown` (no follow-up)   | *(see note)* `donation-receipts`       | yes       | **Playbook not yet written** — manual step in §11 HANDOFF. No intake follow-up — get-doc gathers receipts from the רשות המיסים site / email / manual upload. **Reconciliation flag** (per [ADR-014](../docs/decisions/ADR-014-intake-journey-reconciliation.md)): if checked but no receipt found by collect/calc, surface it (don't silently drop the expected credit). See `tax-rule/donations-46.md § Intake`. |
| (universal NI)  | always                              | `bituach-leumi-payments`               | yes       | Confirms BTL paid/received; needed for net-refund math. |

## v2-stub slugs not yet in the matrix

Most checklist slugs are v2-stubs today — recorded in the profile but no `tax-rule/<slug>.md` spec yet, and no row here. The intake walker records them as `yes`/`unknown` without seeding docs. When promoted, add a row here AND ensure the doc playbook exists in `Collector/documents/`.

Currently v2-stub:

- `job_change`, `partial_year`, `reserves`, `children`
- `mortgage_life_insurance`, `family_medical_support`, `family_disability_75`, `pension_withdrawal`, `capital_markets`
- `single_parent`, `alimony`, `disabled_child`, `medical_disability`, `cpa_fees`, `asset_sale_mas_shevach`
- `degree` (spec exists at `tax-rule/degree-40c-40d.md`; doc seeds still need confirmation — promote to matrix once `Collector/documents/form-119-degree.md` lands)

## Disqualifier slugs (never seed docs)

`osek`, `controlling_shareholder`, `foreign_assets_1_5m`, `kibbutz_member`, `non_resident` — these short-circuit intake at §5 DISQUALIFIERS (no §9 SEED runs). They never seed docs; the partial profile records the disqualifier and intake stops.

## Per-year bucketing for `robintax` wrap-up

A filing year is **`ready`** when every doc slug seeded for that year is `have` in the ledger. Otherwise **`blocked` on `<missing slugs>`**. Years are independent — a user can be `ready` on 2022 and `blocked` on 2023 simultaneously. This is the partial-unblock rule [`robintax/SKILL.md` wrap-up](../.claude/skills/robintax/SKILL.md) depends on.
