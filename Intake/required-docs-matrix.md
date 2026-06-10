# Required-docs matrix

Cross-references `(filing-year, branch-state) → [doc slugs]`. The `intake` skill reads this after the conversation to seed `<memory>/journey.md`'s `## Documents` table. `robintax`'s wrap-up reads it to bucket years into `ready` / `blocked` — replaces the `⚠ Not computed` placeholder in [`.claude/skills/robintax/SKILL.md`](../.claude/skills/robintax/SKILL.md).

## Rules

- Only doc slugs that exist as files in [`Collector/documents/`](../Collector/documents/) may appear here. Adding a slug here without a playbook means `get-doc` can't fulfill it.
- A row's `Status` column is the **profile value** for the branch. `unknown` always seeds the doc (pessimistic include per [ADR-013](../docs/decisions/ADR-013-user-profile-and-intake.md)).
- "Per year" means the same doc slug seeds once per declared filing year, with `(year)` annotation on the ledger row.

## v1 matrix

| Branch          | Profile state                       | Doc slug                               | Per year? | Notes |
|-----------------|-------------------------------------|----------------------------------------|-----------|-------|
| (universal)     | always                              | `form-106`                             | yes       | Every salaried year. Seed per declared year. |
| `household`     | `marital=Married`, `spouse_income∈{yes,unknown}` | `form-106` (spouse) | yes | Annotate ledger row `(spouse YYYY)`. |
| `soldier`       | `yes` or `unknown`                  | `idf-discharge-certificate`            | no (once) | Form 830 covers all years in the 36-month window. |
| `settlement`    | `yes` or `unknown`                  | `residency-confirmation-section-11`    | yes       | Council issues one per claimed year. |
| `immigrant`     | `yes` or `unknown`                  | *(see note)* `immigrant-certificate`   | no (once) | **Playbook not yet written** — surface as manual step (see [`branches/immigrant.md`](branches/immigrant.md)). |
| `donation`      | `yes` (band ≥ ₪200) or `unknown`    | *(see note)* `donation-receipts`       | yes       | **Playbook not yet written** — manual step (see [`branches/donations.md`](branches/donations.md)). |
| (universal NI)  | always                              | `bituach-leumi-payments`               | yes       | Confirms BTL paid/received; needed for net-refund math. |

## What this matrix does NOT cover (v2)

The following branches are v2-stubs in [`branches/`](branches/) and intentionally not in the matrix yet:

- `disability` → `form-169a-medical-committee`
- `degree` → `form-119-degree`
- `pension_self` → `pension-fund-self-deposit`, `life-insurance-deposit`
- `keren_hishtalmut` → `keren-hishtalmut-self`
- `foreign_income` → `foreign-tax-paid`
- `self_employed` → out of scope entirely

When a v2 branch is promoted, add its row here AND ensure the doc playbook exists in `Collector/documents/`.

## Per-year bucketing for `robintax` wrap-up

A filing year is **`ready`** when every doc slug seeded for that year is `have` in the ledger. Otherwise **`blocked` on `<missing slugs>`**. Years are independent — a user can be `ready` on 2022 and `blocked` on 2023 simultaneously. This is the partial-unblock rule [`robintax/SKILL.md` wrap-up](../.claude/skills/robintax/SKILL.md) depends on.
