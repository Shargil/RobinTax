---
section: 91, 92
slug: capital-gains-91-92
status: active
rule_key: separate_rates
last_verified: 2026-06-27
verified_against: [ita-circular-10-2025, y-tax, cpa-dray, kolzchut]
---

# §91 / §92 — Capital-market income & loss-offsetting (מיסוי רווחי הון בשוק ההון וקיזוז הפסדים)

## TL;DR
A salaried person who traded securities (מניות, אג״ח, קרנות) is taxed at flat **separate rates** — **25%** on real capital gains and most dividends/interest, **15%** on nominal (non-CPI-linked) interest, **30%** for a substantial shareholder (בעל מניות מהותי ≥10%). The bank/broker **withholds the tax at source (ניכוי במקור)** per account. The refund angle: a broker withholds on each *gainful* sale but **cannot net a loss in another account, at another broker, or from a prior year** against it — so a trader who had losses, multiple accounts, foreign dividends, or income below the tax-free threshold is frequently **over-withheld** and recovers the difference by filing an annual return with the §92 offset. Carried-forward capital losses (הפסד מועבר) have **no time limit** but are **lost if no return was filed** for the year they arose.

## The law
- **Statutes:**
  - Income Tax Ordinance §91 (`פקודת מס הכנסה — סעיף 91`) — capital-gains tax rate machinery (25% real gain for an individual; 30% for a substantial shareholder).
  - Income Tax Ordinance §92 (`סעיף 92`) — capital-loss offsetting (קיזוז הפסד הון): order of offset, same-year vs carried-forward, the dividend/interest carve-out.
  - Income Tax Ordinance §94B / §94C, §88 (definitions) — supporting capital-gains definitions the rate machinery points to.
  - §121B (`סעיף 121ב`) — surtax (מס יסף) on high income, incl. an additional 2% on high passive income (2025 reform). **Not modeled** — see `## Open questions`.
- **Hebrew name:** מיסוי רווחי הון מניירות ערך וקיזוז הפסדי הון בשוק ההון.
- **Plain English:** A salaried investor's securities gains/dividends/interest are taxed at flat rates and withheld at source by the bank/broker; because withholding is per-account and can't see losses elsewhere or in prior years, the investor is often over-withheld and is owed a refund after §92 offsetting on the annual return.

## Sources
| Source | Where | Last fetched | Role |
|---|---|---|---|
| ITA circular 10/2025 (חוזר מס הכנסה 10/2025 — קיזוז הפסדי הון) | https://www.gov.il/BlobFolder/policy/professional-directives-271125-1/he/IncomeTax_professional-directives-271125-1.pdf | 2026-06-27 | Primary — official §92 interpretation |
| Y-tax (analysis of circular 10/2025) | https://y-tax.co.il/capital-loss-offsetting/ | 2026-06-27 | Primary cross-check — §92 ordering + carve-outs |
| CPA-Dray (investor loss-offset guide) | https://cpa-dray.com/he/blog/קיזוז-הפסדים-בתיק-השקעות/ | 2026-06-27 | Cross-check — refund mechanics, multi-account, FX, FIFO |
| Kolzchut (age-60 benefit on capital income) | https://www.kolzchut.org.il/he/הטבת_מס_מגיל_60_על_רווחי_הון_ועל_ריבית_מפקדונות_ומתוכניות_חיסכון | 2026-06-27 | Rate anchor + the 2% passive surtax |

## Eligibility
**Gate (this rule applies if):**
1. The user **traded securities** (bought/sold מניות / אג״ח / קרנות / ETFs) in the tax year, OR
2. Received **dividends (דיבידנד)** or **interest (ריבית)** from securities/deposits on which tax was withheld at source.

There is no "qualification" threshold like the points-based rules — the question is purely *was tax withheld that a §92 offset (or sub-threshold income) can recover*.

**Rate dispatch (separate rates, flat — not through the brackets):**

| Income | Rate | Engine field |
|---|---|---|
| Real capital gain (רווח הון ריאלי), ordinary holder | 25% | `investment_income.capital_gains` |
| Capital gain — substantial shareholder (בעל מניות מהותי ≥10%) | 30% | `investment_income.capital_gains_substantial` |
| Dividend (דיבידנד), ordinary holder | 25% | `investment_income.dividend_normal` |
| Dividend — substantial shareholder (≥10%) | 30% | `investment_income.dividend_substantial` |
| Interest — CPI-linked / real (ריבית ריאלית, צמודה) | 25% | `investment_income.interest_linked` |
| Interest — nominal / non-linked (ריבית נומינלית, לא צמודה) | 15% | `investment_income.interest_nonlinked` |

## §92 loss-offsetting rules (from ITA circular 10/2025)
A **capital loss (הפסד הון)** from securities offsets, in this order:
1. **Capital gains (רווח הון)** — primary use, any security.
2. **Interest & dividends (ריבית/דיבידנד)** — only under §92(א)(4): permitted **only if the tax rate on that income does not exceed the capital-gains rate** (25% for an individual). Interest from savings plans, deposits, or loans is **excluded** from this carve-out. "Dividend" includes imputed CFC dividends, **not** foreign-branch companies.
3. **Carry-forward (הפסד מועבר)** — an unused loss carries forward **with no time limit**, but applies **only against future capital gains** (not future interest/dividend).

Key principles the circular fixes:
- **חובת קיזוז (mandatory offset)** — a current-year loss must be offset in the year it arose; you cannot "save" it while leaving the year's gains taxed.
- **Nominality (נומינליות)** — losses measured in **nominal** value, no CPI indexation; for linked securities only the **real** component qualifies.
- **Foreign-loss hierarchy** — foreign-source losses must first exhaust against foreign-source income (gains/interest/dividend) before touching Israeli-source income (גרינפלד doctrine).
- **Matching principle (עקרון ההקבלה)** — a loss is deductible only if the corresponding *gain* would have been taxable.
- **Non-transferability** — a loss belongs to the entity/person that incurred it; no transfer between taxpayers (דמארי / מלכסון).
- **FTC precedence** — capital-loss offsetting is computed **before** the foreign tax credit; loss is fully utilized, then FTC applies to the net.
- **Loss is forfeited if no return filed** for the year it arose — "לא ניתן לגרור הפסד אם לא הגשתם דוח שנתי".

## Why a salaried trader gets a refund
- **Per-account withholding** — the bank/broker withholds 25% on each gainful sale but is blind to a loss in another account, at another broker, or from a prior year.
- **Cross-account / cross-broker losses** — gains at bank A and losses at broker B net to ~zero economically, yet A withheld in full → refund on filing.
- **Carried-forward prior-year losses (הפסד מועבר)** — unused losses from earlier filed years wipe out this year's withheld tax.
- **Income below the tax-free threshold** — a low earner whose total income is under the threshold had tax withheld at source it never owed.
- **Foreign dividend withholding** — foreign brokers don't withhold Israeli tax (you may owe), and foreign dividends suffer foreign withholding recoverable via the foreign tax credit (זיכוי מס זר).
- **FX (מט״ח) traps** — a shekel-denominated "paper" gain from a rising USD can be taxed though the position lost value in dollars; precise FX computation can reduce the taxable gain.

## Edge cases
- **No §92 loss field in the engine (architectural limitation)** — `YearInput.investment_income` carries only positive income buckets + `separate_withheld_tax`; there is **no loss input**. The §92 netting (same-year, cross-account, carry-forward, foreign-first ordering) must therefore happen **upstream** (extraction/eligibility layer) and feed the engine **already-netted** figures. The engine taxes whatever positive `capital_gains`/dividend/interest it is handed. See `## Open questions` + the conflict log — feeding gross gains without netting **overstates tax owed and understates the refund**.
- **Capital-source surtax not modeled (W3)** — separate-rate income escapes **both** the §121B 3% surtax (engine applies it only to ordinary income) **and** the additional **2%** passive-income surtax (2025 reform, income above ₪721,560). For a large passive-income year this **understates tax owed and overstates the refund**. Tracked as KNOWN LIMITATION W3 in `Calculator/rules/2024.ts` / `2025.ts`.
- **Foreign tax credit partially modeled** — `separate_withheld_tax` is treated as fully creditable withholding; real FTC has treaty caps and the §92-before-FTC ordering. Conservative for the salaried-resident common case; flag large foreign positions to a CPA.
- **No US-style wash-sale rule** — Israel has no rigid 30-day rule, but the ITA can disallow an עסקה מלאכותית (artificial transaction) lacking economic substance; don't immediately rebuy the identical security.
- **FIFO** — when a holding was bought in tranches, the oldest lot is presumed sold first.
- **Substantial shareholder (≥10%)** — 30% rather than 25% on both gains and dividends.
- **Retroactive claims** — general ITA rule allows up to **6 tax years** back; carried-forward losses are unlimited in time once the originating year was filed.

## Formula
```
# No dedicated engine function — capital-gains-91-92 reads the shared separate-rate
# machinery (separateRateTax + the refund net in calculate()). §92 netting is UPSTREAM
# (the engine has no loss field; it taxes positive buckets as handed to it).

# Upstream (extraction/eligibility — NOT in calculate()):
net_capital_gains      = sum(gains) - sum(losses)            # §92(1), same-year, cross-account
net_capital_gains      = max(0, net_capital_gains - carried_forward_loss)   # §92(3)
# residual loss may offset dividend/interest only if their rate <= capital-gains rate  §92(א)(4)
# foreign losses exhaust foreign income first

# Engine (separateRateTax over the netted positive buckets):
separate_tax  = interest_linked     * 0.25
              + interest_nonlinked   * 0.15
              + dividend_normal      * 0.25
              + dividend_substantial * 0.30
              + capital_gains        * 0.25
              + capital_gains_substantial * 0.30
refund_or_owe = total_withheld - (ordinary_tax + separate_tax)
# over-withholding (broker withheld on gross gains, blind to losses/threshold) → refund.
```

## Required documents
| Doc | Form | Playbook |
|---|---|---|
| Annual broker/bank tax certificate (אישור שנתי על ניכוי מס — ריבית/דיבידנד/רווח הון) | טופס 867 | *not built yet* |
| Realized P&L report per institution (דוח רווח/הפסד ממומש) | (broker statement) | *not built yet* |
| Capital-gains schedule on the annual return (נספח רווחי הון) | טופס 1322 | *not built yet* |

## Worked examples
Each row MUST have a 1:1 test in `Calculator/engine/calculate.test.ts` whose name contains the `id`. The drift test enforces this. (Capital-gains rate examples live in `tax-rule/secondary-102.md`; this spec owns the interest/dividend buckets + the over-withholding refund.)

| id | Scenario | Expected |
|---|---|---|
| `capmkt-interest-linked-25pct` | ₪10,000 CPI-linked interest via `separateRateTax` | 2,500 (25%) |
| `capmkt-interest-nonlinked-15pct` | ₪10,000 nominal (non-linked) interest via `separateRateTax` | 1,500 (15%) |
| `capmkt-dividend-normal-25pct` | ₪10,000 ordinary dividend via `separateRateTax` | 2,500 (25%) |
| `capmkt-dividend-substantial-30pct` | ₪10,000 substantial-shareholder dividend via `separateRateTax` | 3,000 (30%) |
| `capmkt-overwithheld-refund` | No salary; ₪40,000 ordinary dividend; bank withheld ₪12,000 (30%); correct rate 25% | refund ₪2,000, recommendation `file` |

## Intake
This section is read by the `intake` skill walker when the user checks `capital_markets` in [`Intake/checklist.md`](../Intake/checklist.md). The gate is the checklist check itself — the follow-ups below are the queue the walker fires under the `Capital markets {i}/{N}` prefix.

### Gate
- **Checklist label (Hebrew, user-facing):** `סחרתי בשוק ההון`.
- **Options:** Yes | No | I don't know
- **Open follow-ups on:** Yes, I don't know

### Follow-ups
- **`had_losses`** — Description (`rule_lede`, plain Hebrew, shown above the question): "אם קנית ומכרת מניות, אג״ח או קרנות — הבנק או הברוקר ניכה לך מס אוטומטית על הרווחים. אם היו לך גם הפסדים (השנה או בשנים קודמות שלא הגשת עליהן), או חשבונות אצל כמה ברוקרים — ייתכן ששילמת מס מיותר ומגיע לך החזר." Question: "Did you ever sell at a loss — this year, or in past years you didn't file a return for?" Options: `Yes` | `No` | `I don't know`. Reason: §92 loss-offsetting is the #1 refund driver — the broker withholds per gainful sale and can't net losses across accounts or years. Maps to: **seed-gate + upstream §92-netting flag** (the engine has no loss field; netting happens before `investment_income`).
- **`multiple_accounts`** — "Did you hold securities at more than one bank or broker?" Options: `Yes` | `No` | `I don't know`. Reason: each institution withholds independently and can't offset a loss at one against a gain at another — cross-account netting on the annual return is the refund. Maps to: seed one טופס 867 **per institution**.

> **Dropped `foreign_broker`** (reviewed with Yam 2026-06-27): asking "foreign broker / foreign dividends?" changed nothing intake does — the broker certificate is seeded either way, and whether it's an Israeli 867 or a foreign annual statement is revealed *by the document*, not by self-report. The foreign nuance (foreign tax credit + §92 foreign-first netting) is a **calc-stage** concern, already captured in `## Open questions` + the conflict log. Re-add a follow-up only if a foreign-broker doc playbook is built that needs a self-report to route.

### Seeds
- On gate `yes` / `unknown`, OR any follow-up `yes` / `unknown` → seed the **annual broker/bank tax certificate (טופס 867)**. It resolves every engine field (income per bucket, rate, tax withheld) in one document, and reveals whether the institution is Israeli or foreign. **Playbook not built yet** → surface as a manual step in §11 HANDOFF; do not seed a slug `get-doc` cannot fulfill.
- On `multiple_accounts = yes` → seed one 867 **per institution** (manual step lists each).
- On both follow-ups `no` (traded but no losses, single account) → still seed the single 867: sub-threshold income or in-account over-withholding can still produce a refund. Never gate the refund away on `no`.
- **Calc-stage flag (not an intake gate):** if the seeded certificate turns out to be a foreign broker / foreign dividends, the calc stage must apply the **foreign tax credit + §92 foreign-first netting** (unmodeled — see `## Open questions`).

### Profile key
`capital_markets`

## Implementation map
| Slice | File |
|---|---|
| Schema | [`Calculator/rules/types.ts`](../Calculator/rules/types.ts) — `SeparateRates` + `YearInput.investment_income` |
| Year values | [`Calculator/rules/2024.ts`](../Calculator/rules/2024.ts), [`Calculator/rules/2025.ts`](../Calculator/rules/2025.ts) — `separate_rates` |
| Math | [`Calculator/engine/calculate.ts`](../Calculator/engine/calculate.ts) — `separateRateTax()` + the refund net in `calculate()` (no dedicated function; §92 netting is upstream) |
| Tests | [`Calculator/engine/calculate.test.ts`](../Calculator/engine/calculate.test.ts) — `describe('separateRateTax ...')` + `describe('calculate — capital-markets §91/§92 ...')` |
| Doc playbook | *not built yet* — broker/bank annual tax certificate (טופס 867) |
| Checklist entry | [`Intake/checklist.md`](../Intake/checklist.md) → `capital_markets` |
| Profile key | `<memory>/profile.md` → `capital_markets` |
| Drift check | [`tax-rule/drift.test.ts`](drift.test.ts) |

## Year values (canonical — TS rule tables MUST mirror this JSON)
This spec is the canonical owner of the full `separate_rates` block (all six flat rates). The drift test compares the whole `rules.separate_rates.value` against this JSON. (`secondary-102.md` checks only the two capital-gains subfields — a harmless narrower overlap.)
```json
{
  "2024": {
    "interest_linked": 0.25,
    "interest_nonlinked": 0.15,
    "dividend_normal": 0.25,
    "dividend_substantial": 0.30,
    "capital_gains": 0.25,
    "capital_gains_substantial": 0.30
  },
  "2025": {
    "interest_linked": 0.25,
    "interest_nonlinked": 0.15,
    "dividend_normal": 0.25,
    "dividend_substantial": 0.30,
    "capital_gains": 0.25,
    "capital_gains_substantial": 0.30
  }
}
```

## Year-over-year changes
| Year | Change |
|---|---|
| 2024 → 2025 | **No change** to the six flat separate rates. **Note (not modeled):** the 2025 Arrangements Law added a **2% surtax on high passive income** (interest/dividend/capital gains above ₪721,560) on top of the §121B 3% — W3. ITA circular **10/2025** (Nov 2025) restated §92 offset rules (nominality, foreign-first hierarchy, FTC precedence) — interpretation, not a rate change. |

## Open questions
- **§92 loss-offsetting has no engine input** — `investment_income` has no loss field, so all netting (same-year, cross-account, carry-forward, foreign-first) must be done upstream and fed as already-netted positives. Feeding gross gains overstates tax / understates refund. **Must be resolved before computing for any user with realized losses or multiple accounts.** (CONFLICT — see verification log.)
- **Capital-source surtax (מס יסף) not modeled** — separate-rate income escapes both the §121B 3% and the 2025 +2% passive surtax. Tracked as W3 in the year files. **Resolve before computing for a user with large passive income.**
- **Foreign tax credit not modeled** — `separate_withheld_tax` is treated as fully creditable; real FTC has treaty caps + §92-before-FTC ordering.
- **טופס 867 collector playbook not built** — `get-doc` can't yet fetch the broker certificate; intake surfaces it as a manual step.
- **2026 year values not yet captured** — ship a `"2026":` block when filing 2026.

## Verification log
- **2026-06-27** — Initial spec. New rule promoted from the `capital_markets` v2-stub (no prior prose to fold — `secondary-102.md` had explicitly deferred the interest/dividend buckets + loss-offsetting here). Scope/slug confirmed with Yam: §91 rates + §92 loss-offsetting, slug `capital-gains-91-92`. Sources: ITA circular 10/2025 (primary, via y-tax analysis), cpa-dray investor guide, kolzchut age-60 page (rate + 2% surtax anchor). Established that the engine already taxes the six separate-rate buckets via `separateRateTax` — no new engine code or year values. Flipped `Intake/checklist.md` `capital_markets` from `tax-rule: none` to `tax-rule: capital-gains-91-92`. Added 5 worked examples (interest/dividend buckets + over-withholding refund) with tagged tests. CONFLICTS surfaced: (1) §92 loss-offsetting has no engine input field; (2) capital-source surtax (§121B 3% + 2025 +2%) not applied to separate-rate income (pre-existing W3); (3) foreign tax credit not modeled. — Claude
</content>
</invoke>
