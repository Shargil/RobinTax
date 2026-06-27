---
section: 46
slug: donations-46
status: active
rule_key: donation
last_verified: 2026-06-27
verified_against: [kolzchut, annual-deductions-2024, annual-deductions-2025]
---

# §46 — Credit for Donations to a Recognized Public Institution (זיכוי ממס בגין תרומה למוסד ציבורי מאושר)

## TL;DR
A tax **credit** of **35%** on money donated to a public institution that holds a §46 approval (אישור לפי סעיף 46). Kicks in only once the **annual total** across all institutions clears the floor (₪207 in 2024–2025). The eligible donation base is capped at the **lower of 30% of taxable income or an absolute ceiling** (₪10,354,816 in 2024–2025); anything above the cap **carries forward 3 tax years**. Pure credit — it reduces tax owed and is refundable only against tax already withheld; it never pays out beyond that.

## The law
- **Statutes:**
  - Income Tax Ordinance §46 (`פקודת מס הכנסה — סעיף 46`) — the donation credit, the 35% individual rate, the min-floor, and the dual abs/share ceiling.
  - Income Tax Ordinance §9(2) — defines "מוסד ציבורי"; §46 approval is the operative gate, granted by רשות המיסים.
- **Hebrew name:** זיכוי ממס הכנסה בשל תרומה למוסד ציבורי מוכר (סעיף 46).
- **Plain English:** Anyone who donates more than the annual floor to one or more §46-approved public institutions, and has Israeli income tax to credit against, gets 35% of the eligible donation back as a credit.

## Sources
| Source | Where | Last fetched | Role |
|---|---|---|---|
| Kolzchut | https://www.kolzchut.org.il/he/זיכוי_ממס_הכנסה_בשל_תרומה_(סעיף_46) | 2026-06-27 | Primary cross-check |
| ITA annual-deductions 2024 | `Calculator/rules/sources/2024/annual-deductions-2024.pdf`, lines 480, 484 | (archived) | Min-floor + absolute ceiling |
| ITA annual-deductions 2025 | `Calculator/rules/sources/2025/annual-deductions-2025.pdf`, lines 504–509 | (archived) | Min-floor + absolute ceiling |
| ITA approved-institutions lookup | https://www.gov.il/he/service/confirmation-of-donations | 2026-06-27 | Verifies a given org holds §46 approval |

## Eligibility

**Gate (all required):**
1. Donated to **one or more institutions that hold a §46 approval** (אישור לפי סעיף 46). A registered עמותה (ע"ר) or חברה לתועלת הציבור (חל"צ) is *not* enough on its own — the §46 approval is the operative requirement.
2. **Annual total** across all institutions ≥ the per-year floor (₪207 for 2024–2025). The floor is on the year's combined giving, not per donation.
3. Has Israeli income tax owed / withheld in the year to credit against. (No tax → nothing to refund; the credit cannot generate cash beyond tax paid.)

**Caps (the eligible base is the lower of the two):**
| Cap | Value |
|---|---|
| Absolute ceiling | ₪10,354,816 (2024–2025) |
| Share of taxable income | 30% of that year's taxable income |

## Edge cases
- **The floor is a qualifying threshold, not a deductible.** Once the annual total clears the floor, the **whole** eligible amount is credited at 35% — *not* only the portion above the floor. (Engine matches: `eligible = min(donations, cap)`, applied to the full amount once `donations ≥ floor`.)
- **Carry-forward** — donations above the cap roll into the **next 3 tax years** and combine with those years' giving (each year still bounded by its own cap). Source: "הסכום שנתרם עולה על שיעורי התקרה ל-3 שנות המס הבאות". **Not modeled by the engine** — RobinTax computes one year in isolation, so above-cap excess is silently dropped. See Open questions; flag for a user whose donation exceeds 30% of taxable income.
- **Spouses** — a jointly-given donation can be claimed by **either** spouse; they elect who takes the credit.
- **No credit for volunteer hours / services** — "לא יינתן זיכוי ממס עבור שעות עבודה ומתן שירותים". Only money (and money-equivalent) donations count.
- **Foreign institutions** — not eligible. §46 approval is granted only to Israeli bodies.
- **Dual-incentive cap** — if the donor also claims a deduction under §20A (R&D funding) or the securities-investment law, the **combined deduction + credit cannot exceed 50% of taxable income** that year. Niche for salaried filers.
- **Cannot generate refund beyond tax owed** — pure credit; refundable only against tax already withheld.
- **Retroactive claims** — up to **6 tax years** back (from 2026, back to 2020), the general ITA refund window.

## Formula
```
abs_cap   = rule.max_eligible_nis_absolute
share_cap = taxable_ordinary × rule.max_eligible_share_of_taxable_income

if donations_nis < rule.min_eligible_nis_per_year:
    return 0

cap      = min(abs_cap, share_cap)
eligible = min(donations_nis, cap)
credit   = eligible × rule.rate          # rate = 0.35
```
(Carry-forward of `donations_nis − cap` into the next 3 years is **not** implemented.)

## Required documents
| Doc | Form | Playbook |
|---|---|---|
| Donation receipt (קבלה) — original, certified copy ("נאמן למקור"), or digital receipt stamped "מסמך ממוחשב" with donor details | — | *not built yet — user-held; manual step* |
| In-year tax coordination | טופס 116 | *not built yet (post-year-end filing reads the receipt directly)* |

The receipt is held by the donor, not fetched from a portal — `get-doc` cannot retrieve it. Intake seeds a **manual "gather your §46 receipts"** step (see `Intake/required-docs-matrix.md` → `donations`). The receipt carries both the donated amount (engine input `donations_nis`) and the institution's §46 approval number.

## Worked examples
Each row MUST have a 1:1 test in `Calculator/engine/calculate.test.ts` whose name contains the `[id]`. The drift test enforces this. Scenarios use the fixture year (`min_eligible_nis_per_year: 200`, `rate: 0.35`, `max_eligible_share_of_taxable_income: 0.30`, `max_eligible_nis_absolute: 9,000,000`).

| id | Scenario | Expected |
|---|---|---|
| `below-min` | Donate ₪150, taxable ₪100k (below the floor) | 0 |
| `at-min-boundary` | Donate ₪200 (== floor), taxable ₪100k → 200 × 0.35 | 70 |
| `under-cap` | Donate ₪1,000, taxable ₪100k (well under both caps) → 1,000 × 0.35 | 350 |
| `share-cap` | Donate ₪50k, taxable ₪100k → share-cap 30k binds → 30k × 0.35 | 10,500 |

## Intake
This section is read by the `intake` skill walker when the user checks `donations` in [`Intake/checklist.md`](../Intake/checklist.md). The gate is the checklist check itself — **donations asks no follow-up.**

### Gate
- **Checklist label (Hebrew, user-facing):** `תרמתי לעמותה`.
- **Options:** Yes | No | I don't know
- **Open follow-ups on:** none

### Follow-ups
None. Donations needs no intake follow-up. The only engine input (`donations_nis`) comes off the receipt, which is gathered in the **`get-doc` stage** from the three sources (the רשות המיסים site / email / manual upload) — asking the amount or the §46-approval status at intake would just duplicate what collection resolves. Checking the box seeds the receipt-gathering step; that's all intake needs to do.

### rule_lede (not shown at intake — there is no follow-up to host it; reused by `get-doc` when it gathers receipts)
"אם תרמת לעמותה או למוסד ציבורי שמאושר לתרומות לפי סעיף 46, מגיע לך זיכוי מס של 35% מהתרומה. אפשר למצוא את התרומות באתר רשות המיסים, באימייל, או להעלות אותן."

### Seeds
- On gate ∈ {`yes`, `unknown`} → seed the manual **"gather your §46 donation receipts"** step (doc `donation-receipts`, no portal playbook). `get-doc` pulls from the רשות המיסים site, email, or manual upload; the receipt resolves the exact amount + the §46-approval number.
- On gate = `no` → not selected, nothing seeded.
- **Reconciliation flag** — if `donations` was checked (and seeded) but collect/calc finds **no** §46 receipt, surface a flag to the user. They expected a donation credit; don't silently drop it. This is an instance of the general no-orphaned-expectations rule — see [ADR-014](../docs/decisions/ADR-014-intake-journey-reconciliation.md). `robintax` (resume) + `calc-refund` (pre-file gate) own the check; this spec just declares the seed so the diff can see it.

### Profile key
`donations`

## Implementation map
| Slice | File |
|---|---|
| Schema | [`Calculator/rules/types.ts`](../Calculator/rules/types.ts) — `DonationRule` |
| Year values | [`Calculator/rules/2024.ts`](../Calculator/rules/2024.ts), [`Calculator/rules/2025.ts`](../Calculator/rules/2025.ts) — `donation` |
| Math | [`Calculator/engine/calculate.ts`](../Calculator/engine/calculate.ts) — `donationCredit()` / `donationCreditTraced()` |
| Tests | [`Calculator/engine/calculate.test.ts`](../Calculator/engine/calculate.test.ts) — `describe('donationCredit')` |
| Doc playbook | *not built yet — user-held receipt, manual step* |
| Checklist entry | [`Intake/checklist.md`](../Intake/checklist.md) → `donations` |
| Profile key | `<memory>/profile.md` → `donations` |
| Drift check | [`tax-rule/drift.test.ts`](drift.test.ts) |

## Year values (canonical — TS rule tables MUST mirror this JSON)
```json
{
  "2024": {
    "rate": 0.35,
    "min_eligible_nis_per_year": 207,
    "max_eligible_nis_absolute": 10354816,
    "max_eligible_share_of_taxable_income": 0.30
  },
  "2025": {
    "rate": 0.35,
    "min_eligible_nis_per_year": 207,
    "max_eligible_nis_absolute": 10354816,
    "max_eligible_share_of_taxable_income": 0.30
  }
}
```

## Year-over-year changes
| Year | Change |
|---|---|
| 2024 → 2025 | No change. Min-floor ₪207, absolute ceiling ₪10,354,816, rate 35%, share-cap 30% all frozen. |

The rate (35%) and share-cap (30%) are statutory and stable. The min-floor and absolute ceiling are **indexed annually**. Historical source values (not yet ingested — 2020–2023 are engine-wide scaffold stubs): 2023 → ₪200 / ₪10,019,808; 2022 → ₪190 / ₪9,517,000; 2021 → ₪190 / ₪9,294,000; 2020 → ₪190 / ₪9,350,000. Ingest the matching floor + ceiling when a pre-2024 year is wired up.

## Open questions
- **Carry-forward (3 years) not implemented.** A user who donates above 30% of taxable income loses the excess in our calc instead of rolling it forward. Cross-year state would be needed. Low impact for typical salaried donations; flag when `donations_nis > 0.30 × taxable_ordinary`.
- Pre-2024 year values (2020–2023) not captured — ship the indexed floor + ceiling per the table above when filing those years.
- No `donation-receipts` Collector playbook (receipt is user-held); intake surfaces it as a manual step.

## Verification log
- **2026-06-27** — Initial spec. Folded from `Calculator/rules/types.ts` `DonationRule` docstring + `2024.ts`/`2025.ts` donation blocks + `calculate.ts` `donationCreditTraced` comment + existing `donationCredit` tests. Gap-passed against kolzchut "זיכוי ממס הכנסה בשל תרומה (סעיף 46)" (fetched 2026-06-27). Added: §46-approval gate, 35% rate, annual floor (₪207 / yearly-indexed), dual abs/share cap, 3-year carry-forward (noted as not-implemented), spouse election, no-credit-for-volunteer-hours, foreign-institution exclusion, §20A dual-incentive 50% cap, 6-year retro window, receipt requirements. 2024/2025 code values match source exactly — **zero conflicts**. Registered in `Intake/checklist.md` (`donations` → `tax-rule: donations-46`). Tagged 3 existing tests + added `at-min-boundary`. §11 review with Yam: **dropped the intake follow-up entirely** — donations asks nothing beyond the checklist gate. Receipt collection (amount + §46-approval) happens in the get-doc stage from the רשות המיסים site / email / manual upload, so any intake follow-up would be premature. Added a **reconciliation flag**: checked-but-no-receipt-found must be surfaced, not silently dropped. Lede retained for get-doc to show when gathering receipts (no intake render surface without a follow-up). — Claude
