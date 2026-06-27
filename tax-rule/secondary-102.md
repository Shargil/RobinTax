---
section: 102
slug: secondary-102
status: active
rule_key: separate_rates
last_verified: 2026-06-27
verified_against: [y-tax, shibolet, kolzchut]
---

# §102 — Hi-tech secondary share/option sale, capital-gains track (מכירת מניות/אופציות בעסקת סקנדרי — מסלול רווח הון)

## TL;DR
A hi-tech employee sells **already-vested** shares or options to an outside buyer in a *secondary* transaction (existing shares change hands — no new shares issued, money flows between shareholders not into the company). If the equity was granted under **§102 capital-gains track** (held by a trustee — נאמן — for ≥24 months from grant), the gain is taxed at a flat **25%** (or **30%** if the seller is a substantial shareholder, בעל מניות מהותי ≥10%) instead of marginal rates up to ~50%. The refund angle: the **paying trustee (נאמן משלם) withholds tax at source**, often at the top/most-conservative rate, so a salaried filer is frequently **over-withheld** and recovers the difference through the annual return.

## The law
- **Statutes:**
  - Income Tax Ordinance §102 (`פקודת מס הכנסה — סעיף 102`) — employee equity; the capital-gains track (מסלול הוני) gives the 25% rate subject to the trustee + 24-month holding conditions.
  - Income Tax Ordinance §91 / §88 (`סעיף 91 / 88`) — capital-gains rate machinery the §102 capital track points to (25%, 30% for a substantial shareholder).
- **Hebrew name:** מכירת מניות/אופציות של עובד הייטק בעסקת סקנדרי, במסלול רווח הון לפי סעיף 102.
- **Plain English:** A salaried hi-tech worker who sold vested §102-capital-track equity in a secondary is taxed at 25% (30% if ≥10% owner); because the trustee withheld tax up front, often at the highest rate, the worker can be owed a refund.

## Sources
| Source | Where | Last fetched | Role |
|---|---|---|---|
| Y-tax (secondary in hi-tech) | https://y-tax.co.il/secondary-transactions-in-high-tech/ | 2026-06-27 | Primary cross-check (secondary mechanics) |
| Shibolet (§102 options) | https://www.shibolet.com (מיסוי אופציות לעובדים) | 2026-06-27 | §102 track + 24-month trustee rule |
| Kolzchut / general §102 corpus | search corpus (wintax, IBI, prisha) | 2026-06-27 | Cross-check on tracks + rates |

## Eligibility
**Gate (all required for the capital-gains track / 25%):**
1. The sold instrument is **employee equity granted under §102 capital-gains track** (מסלול הוני), held via a **trustee (נאמן)**.
2. The trustee held the shares/options for **≥24 months from the grant date** (the blocking period — תקופת חסימה) before the sale.
3. The transaction is a **secondary** — sale of existing shares to a buyer (not the company issuing new shares, not a salary-substitute payout).

**Rate dispatch:**

| Seller | Rate | Engine bucket |
|---|---|---|
| Ordinary holder (<10%) | 25% | `investment_income.capital_gains` |
| Substantial shareholder (בעל מניות מהותי, ≥10%) | 30% | `investment_income.capital_gains_substantial` |

If the gate fails (sold before 24 months, no trustee, or work-contingent consideration), the proceeds fall to the **ordinary-income track (מסלול פירותי)** — marginal rates, taxed as employment income — and this rule does **not** apply.

## Edge cases
- **Sold before 24 months (breach of חסימה)** — the preferential 25% is lost; the whole gain is taxed as ordinary employment income at marginal rates. Source: "if the sale occurred before the two-year period elapsed under Section 102, the employee would be required to pay ordinary (marginal) tax instead of capital gains tax."
- **Work-contingent / reclassified portion** — where consideration is tied to continued employment, a non-compete, or shares converted to preferred with different economic rights, the ITA may reclassify part of the gain as **employment income (~50%)**. The capital-gains rule covers only the capital-source portion.
- **Substantial shareholder (≥10%)** — 30% rather than 25%; routes to `capital_gains_substantial`.
- **Capital-source surtax (מס יסף on capital gains)** — high earners owe surtax on capital-source income on top of the 25%/30%. **NOT modeled** by the engine (KNOWN LIMITATION W3 in the year files). See `## Open questions` + the conflict log — for a large secondary this understates tax owed and overstates the refund.
- **30-day reporting** — a secondary must be self-reported within 30 days of sale (תוך 30 יום ממועד המכירה), separate from the annual return. Product-surface obligation, not part of the refund math.
- **Foreign / relocated sellers** — non-residents and post-grant relocations raise treaty/double-tax questions and possible exemptions. Out of scope for RobinTax v1 (salaried Israeli residents); flag to a CPA.
- **Cannot apply if ordinary-track** — if the gain is employment income (track failed), it belongs in `employments[]`, not `investment_income`, and is taxed through the brackets.
- **Retroactive claims** — general ITA rule allows up to 6 tax years back.

## Formula
```
# No dedicated engine function — secondary-102 is a CLASSIFICATION rule that routes
# proceeds into the existing separate-rate machinery (separateRateTax + the refund net).

if capital_gains_track AND held_via_trustee >= 24 months:
    if substantial_shareholder (>=10%):
        investment_income.capital_gains_substantial += gain
    else:
        investment_income.capital_gains += gain
    investment_income.separate_withheld_tax += tax_withheld_by_trustee
else:
    # ordinary track — not this rule; gain goes to employments[] at marginal rates.

separate_tax  = capital_gains * 0.25 + capital_gains_substantial * 0.30 + (other separate items)
refund_or_owe = total_withheld - (ordinary_tax + separate_tax)
# over-withholding by the trustee (withheld 30% on a 25% gain, or before credits) → refund.
```

## Required documents
| Doc | Form | Playbook |
|---|---|---|
| Trustee withholding/sale certificate (אישור מהנאמן על המכירה וניכוי המס) | טופס 867 / נאמן statement | *not built yet* |
| Capital-gains computation (where filed) | טופס 1399 | *not built yet* |

## Worked examples
Each row MUST have a 1:1 test in `Calculator/engine/calculate.test.ts` whose name contains the `id`. The drift test enforces this.

| id | Scenario | Expected |
|---|---|---|
| `secondary-25pct-capital-track` | ₪200,000 gain, §102 capital track, ordinary holder (<10%), via `separateRateTax` | 50,000 (25%) |
| `secondary-30pct-substantial` | ₪200,000 gain, substantial shareholder (≥10%), via `separateRateTax` | 60,000 (30%) |
| `secondary-overwithheld-refund` | No salary; ₪100,000 capital-track gain; trustee withheld ₪30,000 (30%); correct rate 25% | refund ₪5,000, recommendation `file` |

## Intake
This section is read by the `intake` skill walker when the user checks `secondary_sale` in [`Intake/checklist.md`](../Intake/checklist.md). The gate is the checklist check itself — the follow-ups below are the queue the walker fires under the `Secondary {i}/{N}` prefix.

### Gate
- **Checklist label (Hebrew, user-facing):** `קיבלתי סקנדארי (הייטק)`.
- **Options:** Yes | No | I don't know
- **Open follow-ups on:** Yes, I don't know

### Follow-ups
- **`holding_track`** — Description (`rule_lede`, plain Hebrew, shown above the question): "אם מכרת מניות או אופציות של חברת הייטק בעסקת סקנדרי, ובן אדם שלישי (נאמן) החזיק אותן לפחות שנתיים — הרווח ממוסה ב-25% בלבד, ולא לפי המדרגות הרגילות. בדרך כלל הנאמן מנכה מס גבוה מראש, אז יכול להיות שמגיע לך החזר. אם מכרת לפני שנתיים — זה ממוסה כמו משכורת ואין הטבה." Question: "Were the shares/options held by a trustee (נאמן) for at least 2 years before you sold?" Options: `Yes (2+ years via trustee)` | `No / less than 2 years` | `I don't know`. Reason: gates the 25% capital-gains track vs the ordinary (marginal) track. On non-capital-track the gain is salary, not `investment_income`. Maps to: classification into `investment_income.capital_gains` (vs `employments[]`). 
- **`substantial_shareholder`** — "Did you own 10% or more of the company?" Options: `No (under 10%)` | `Yes (10% or more)` | `I don't know`. **Conditional:** ask only if `holding_track ∈ {Yes, I don't know}`. Reason: substantial shareholder is taxed at 30%, others at 25%. Maps to engine input bucket `investment_income.capital_gains_substantial` (Yes) vs `investment_income.capital_gains` (No). 
- **`tax_withheld`** — "Was tax withheld from the proceeds by the trustee or paying agent?" Options: `Yes` | `No` | `I don't know`. **Conditional:** ask only if `holding_track ∈ {Yes, I don't know}`. Reason: the refund is `withheld − owed`; trustees commonly withhold at the top rate, so a Yes is the refund signal. Maps to engine input `investment_income.separate_withheld_tax`. 

### Seeds
- On `holding_track = No / less than 2 years` → capital-track branch is `n/a` (gain is ordinary salary income, covered by the 106s already seeded). Do **not** seed a secondary doc.
- On `holding_track ∈ {Yes, I don't know}` → seed the **trustee withholding/sale certificate** (אישור מהנאמן / טופס 867) — it resolves the gain amount, the rate bucket, and the tax withheld in one document. **Playbook not built yet** → surface as a manual step in §11 HANDOFF; do not seed a slug `get-doc` cannot fulfill.
- On gate `unknown` → seed the trustee certificate (cheap to check).

### Profile key
`secondary_sale`

## Implementation map
| Slice | File |
|---|---|
| Schema | [`Calculator/rules/types.ts`](../Calculator/rules/types.ts) — `SeparateRates` (`capital_gains`, `capital_gains_substantial`) + `YearInput.investment_income` |
| Year values | [`Calculator/rules/2024.ts`](../Calculator/rules/2024.ts), [`Calculator/rules/2025.ts`](../Calculator/rules/2025.ts) — `separate_rates` |
| Math | [`Calculator/engine/calculate.ts`](../Calculator/engine/calculate.ts) — `separateRateTax()` + the refund net in `calculate()` (no dedicated function — classification rule) |
| Tests | [`Calculator/engine/calculate.test.ts`](../Calculator/engine/calculate.test.ts) — `describe('separateRateTax ...')` + `describe('calculate — secondary §102 ...')` |
| Doc playbook | *not built yet* — trustee certificate (טופס 867) |
| Checklist entry | [`Intake/checklist.md`](../Intake/checklist.md) → `secondary_sale` |
| Profile key | `<memory>/profile.md` → `secondary_sale` |
| Drift check | [`tax-rule/drift.test.ts`](drift.test.ts) |

## Year values (canonical — TS rule tables MUST mirror this JSON)
Secondary-102 owns no exclusive rate table; it reads the two capital-gains rates inside the shared `separate_rates` block (the interest/dividend fields belong to a future capital-markets spec). The drift test compares only these two subfields against `rules.separate_rates.value`.
```json
{
  "2024": {
    "capital_gains": 0.25,
    "capital_gains_substantial": 0.30
  },
  "2025": {
    "capital_gains": 0.25,
    "capital_gains_substantial": 0.30
  }
}
```

## Year-over-year changes
| Year | Change |
|---|---|
| 2024 → 2025 | No change to the 25% / 30% capital-gains rates. **Note:** a capital-source surtax (מס יסף, ~2%) phased in for high earners — NOT modeled by the engine (W3). See `## Open questions`. |

## Open questions
- **Capital-source surtax (מס יסף) not modeled** — the engine taxes the secondary gain at a flat 25%/30% and applies the §121B surtax only to ordinary income. The source describes an effective ceiling of "25–35% including surtax" for high earners. For a large secondary this understates tax owed and overstates the refund. Tracked as KNOWN LIMITATION W3 in `Calculator/rules/2024.ts` / `2025.ts`. **Must be resolved before computing for a user with a large secondary gain.**
- **Trustee-certificate (טופס 867) collector playbook not built** — `get-doc` cannot yet fetch the proof doc; intake surfaces it as a manual step.
- **Ordinary-track classification** — when the 24-month/trustee gate fails, the gain is salary income belonging in `employments[]`; the intake walker records the branch but the re-routing into ordinary income is a manual classification step (no automatic mover).

## Verification log
- **2026-06-27** — Initial spec. New rule (no prior prose to fold). Section/scope confirmed with Yam: §102 capital-gains track, slug `secondary-102`. Sources: y-tax secondary page (primary), Shibolet §102, general §102 search corpus. Established that the engine already models the refund via `separateRateTax` + `investment_income.{capital_gains, capital_gains_substantial, separate_withheld_tax}` — no new engine code or year values. Flipped `Intake/checklist.md` `secondary_sale` from `tax-rule: none` to `tax-rule: secondary-102`. CONFLICT surfaced: capital-source surtax (מס יסף) not modeled (pre-existing W3) — load-bearing for this rule. — Claude
