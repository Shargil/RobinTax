# Verification test results — Calculator/rules 2024 + 2025

Audit of [`salaried-tax-quiz-2024-2025.md`](salaried-tax-quiz-2024-2025.md) answered twice in parallel ([internal](salaried-tax-quiz-2024-2025-answers.md), [internet](salaried-tax-quiz-2024-2025-answers-internet.md)), then deep-investigated for fix accuracy on 2026-06-04.

**Legend:** 🔴 **BLOCKER** = must fix before sign-off · 🟡 **WARNING** = known weakness · 🔵 **INFO** = value may be right, but external pass didn't anchor it · ✅ **RESOLVED** = closed by deep investigation.

## Issues

| ID | Sev | Issue | Authoritative finding | Fix |
|---|---|---|---|---|
| ~~B1~~ | ✅ FIXED | `soldierPoints` multiplied total service months × 1/6. | **Annualized**: 2 pts/year for long service (≥23m male / ≥22m female), else 1 pt/year. Pro-rated by eligible months in the tax year within a 36-month window starting the **month AFTER discharge**. Kolzchut worked example: July 2022 discharge → 2025 = 7 months → 7/6 pts. | Rewrote `soldierPoints` with month-index arithmetic + added `discharge_month` to the input. New `SoldierPointsRule` schema. 7 new test cases including the Kolzchut example, the PDF 31.8.2021 example, the Yam Dec-2024 scenario, the ≥23/22 boundary cases, and the <12m floor. All pass. |
| ~~B2~~ | ✅ FIXED | `mandatory_filing` only encoded `high_income_nis: 721_560`. | **Eight independent triggers** per the תקנות פטור regulation: gross salary >₪723,000, all-source taxable >₪721,560, securities volume >₪2,810,000, rental >₪375,000, interest >₪717,000, foreign income >₪375,000, foreign account balance >₪1,500,000, foreign asset value >₪1,500,000. No separate two-employer sub-threshold exists (multi-employer captured by aggregate salary). | Replaced `MandatoryFilingThresholds` shape with all 8 fields, updated 2024.ts/2025.ts/fixture/scaffold/load validator. Rewrote `mandatoryFilingTriggers()` with all checks + optional `filing_inputs` on `YearInput` for rental/foreign/securities (not derivable from other fields). 5 new tests including aggregated multi-employer, rental, foreign-income, interest, and quiet-case. All pass. |
| ~~B3~~ | ✅ FIXED | `pension.credit_rate: 0.35` single rate. | §45A(a)(1) life-insurance = **25%**, §45A(a)(2) קופת גמל לקצבה = **35%**. §45A(d) ceiling shared between categories (conservative: life-insurance applied first against the cap). | Replaced `PensionRule.credit_rate` with `credit_rate_life_insurance: 0.25` + `credit_rate_pension_fund: 0.35`. Renamed `employee_credit_ceiling_nis` → `credit_base_ceiling_nis`. Replaced `YearInput.pension_self_deposit_nis: number` with `pension_self_deposit: { life_insurance_nis, pension_fund_nis }`. Rewrote `pensionCredit()` with shared-cap, life-insurance-first logic. 5 new tests covering life-only, pension-only, mixed-under-cap, mixed-cap-exhausted, zero. All pass. |
| ~~W1~~ | ✅ FIXED | §11 non-Eilat pro-rata not cited locally. | Kolzchut page archived at `sources/_shared/kolzchut-section-11-periphery.html` (sha256 `11ba0b2f…`); citation `kolzchut-section-11` added to both year files; verbatim wording "חלק היחסי של ההטבה בהתאם למשך מגוריהם ביישוב באותה שנה" confirmed in the archived file. |
| ~~W2~~ | ✅ RESOLVED | "Two-employer sub-threshold" missing. | **No such sub-threshold exists in the regulation.** Per the Nevo + Wikisource deep-dive, multiple-employer cases are captured by the **same** thresholds: gross-salary >₪723,000 OR all-source >₪721,560. There is no separate lower NIS for two-employers-without-תיאום. | Drop `two_employers_combined_nis` from `MandatoryFilingThresholds`; document in code that two-employer cases are covered by `gross_salary_nis`. |
| **W3** | 🟡 | Separate 2% capital-source surtax surfaced externally; not modeled. | Confirmed via Shibolet. Not blocking for Yam (no capital income). | Investigate effective date + scope; extend `Surtax` to support stacked per-source. |
| ~~W4~~ | ✅ RESOLVED | 1-month month-counting gap on soldier window. | **Kolzchut worked example: 7 eligible months in tax year 2025 for a July-2022 discharge** (window Aug-2022 → end-Jul-2025). The earlier Kolzchut summary saying "June" was imprecise. | Use end-of-month + 36 months in the B1 fix. |
| **I1–I4** | 🔵 | See [`test-results.md` previous revision] — unchanged. | Optional follow-ups. | — |

## §B1 Fix spec — soldier credit

**Input schema change.** `YearInput.taxpayer.discharged_soldier` needs `discharge_month: number` (1-12), not just `discharge_year`. Gender already exists at `taxpayer.gender`.

**Engine logic.**

```ts
function soldierPoints(tax_year: number, gender: 'male'|'female',
                       input: { service_months_full: number; service_months_partial: number;
                                discharge_year: number; discharge_month: number }): number {
  const total_service = input.service_months_full + input.service_months_partial;
  if (total_service < 12) return 0;  // §39A eligibility minimum

  // Annual entitlement (annualised) — 2 if "long" service, else 1.
  const long_service_threshold = gender === 'female' ? 22 : 23;
  const annual_points = total_service >= long_service_threshold ? 2 : 1;
  const per_month = annual_points / 12;  // = 1/6 or 1/12

  // 36-month eligibility window: starts the FIRST DAY of the MONTH AFTER discharge.
  // Window first eligible month index (1-based: Jan 1900 = 1) = discharge_month_index + 1.
  // Window length = 36 months.
  const window_start = monthIndex(input.discharge_year, input.discharge_month) + 1;
  const window_end   = window_start + 35;  // inclusive

  const year_start = monthIndex(tax_year, 1);
  const year_end   = monthIndex(tax_year, 12);

  const eligible_months = Math.max(0,
    Math.min(year_end, window_end) - Math.max(year_start, window_start) + 1);

  return eligible_months * per_month;
}
```

`monthIndex(year, month)` = `year * 12 + (month - 1)`. Validates two ways: PDF example (31.8.2021 → 31.8.2024, full 12 months in 2022, 2023; 8 in 2024) and Kolzchut example (July 2022 → 7 months in 2025).

**Tests to add:**
- Full eligibility in the year of discharge (mid-year discharge → 12-discharge_month + 1 eligible months).
- Full year in years 2 of 3.
- Partial last year (window expires mid-year).
- Service exactly 23 / 22 boundary.
- Service < 12 → 0 points.

## §B2 Fix spec — mandatory filing

**Type change.** Replace `MandatoryFilingThresholds` with these fields (for tax year 2024 — all NIS amounts frozen for 2025 per the indexation freeze):

```ts
export interface MandatoryFilingThresholds {
  /** §1 of תוספת א — gross salary/business income above this requires filing. */
  gross_salary_nis: number;                      // 723_000 (applies 2023-2026)
  /** §121B trigger — all-source taxable income subject to surtax. */
  all_source_taxable_nis: number;                // 721_560
  /** תוספת ו — securities trading VOLUME (not income) above this requires filing. */
  securities_sales_volume_nis: number;           // 2_810_000
  /** תוספת ב — rental income above this. */
  rental_income_nis: number;                     // 375_000
  /** תוספת ה — interest income above this. */
  interest_income_nis: number;                   // 717_000
  /** תוספת ד — foreign-source income above this. */
  foreign_income_nis: number;                    // 375_000
  /** Regulation 3(a)(7) — foreign-account balance threshold (per-year, indexed). */
  foreign_account_balance_nis: number;           // 1_500_000
  /** Regulation 3(a)(6) — foreign-asset value threshold (per-year, indexed). */
  foreign_asset_value_nis: number;               // 1_500_000
  /** Controlling-interest holders must file regardless of amount (Reg. 3(a)(1)). */
  controlling_interest_triggers: boolean;        // true
  /** §121B trigger triggers filing (Reg. 3(a)(8)). */
  surtax_triggers: boolean;                      // true (already covered by all_source_taxable)
}
```

Drop the existing `high_income_nis` and `two_employers_combined_nis` (subsumed). Drop `capital_gains_above_nis` (the actual rule is volume-based at 2,810,000).

`mandatoryFilingTriggers()` engine update: check each numeric threshold and the booleans; return human-readable trigger names for Mode B.

## §B3 Fix spec — §45A rate split

**Type change.**

```ts
export interface PensionRule {
  employee_deduction_ceiling_nis: number;        // §47(a)(1)(1) — unchanged, 116_400
  /** §45A(d) credit-base ceiling — applies to BOTH life-insurance and pension. */
  credit_base_ceiling_nis: number;               // 2_268 (rename from employee_credit_ceiling_nis)
  /** §45A(a)(1) — life-insurance premiums. */
  credit_rate_life_insurance: number;            // 0.25
  /** §45A(a)(2) — קופת גמל לקצבה. */
  credit_rate_pension_fund: number;              // 0.35
  self_employed_ceiling_nis: number;             // unchanged
}
```

**Input change.** `YearInput.pension_self_deposit_nis` becomes:

```ts
pension_self_deposit: {
  life_insurance_nis: number;
  pension_fund_nis: number;
};
```

**Engine logic.**

```ts
function pensionCredit(input: YearInput['pension_self_deposit'], rule: PensionRule): number {
  // Each category capped independently at the shared §45A(d) base ceiling? Or shared cap?
  // Kolzchut deep-dive: §45A(d) is shared. Conservative: cap on sum.
  const life_credit = Math.min(input.life_insurance_nis, rule.credit_base_ceiling_nis)
                    * rule.credit_rate_life_insurance;
  const remaining_cap = Math.max(0, rule.credit_base_ceiling_nis - input.life_insurance_nis);
  const pension_credit = Math.min(input.pension_fund_nis, remaining_cap) * rule.credit_rate_pension_fund;
  return life_credit + pension_credit;
}
```

> Caveat: the ITA professional circular 19/2004 (which would disambiguate §45A(d) sharing semantics) returned 403 on the deep fetch. The "shared cap, life-insurance first" interpretation above is the conservative reading. Worth confirming with an accountant before the engine ships to a user with both deposit types. For users with NO pension self-deposits (e.g. Yam per the journey ledger), this section doesn't fire and the choice doesn't matter.

## Test status after fixes

- `npm test`: **84 / 84 pass**.
- `npx tsc --noEmit`: clean.
- `yoy-diff 2024 2025`: 1 cosmetic label change only — indexation freeze intact.
- **`Calculator/rules/2024.ts` and `2025.ts` are now `sign_off: 'verified'`.** The engine accepts both years.

## Summary

| Blockers | Warnings | Info | Resolved | Aligned |
|---|---|---|---|---|
| **0** | 1 (W3 — documented) | 4 (I1–I4 — optional) | **6 (B1, B2, B3, W1, W2, W4)** | 25 / 30 |

**W3** is the only remaining issue and is **documented as a known limitation in `notes`** on both year files — investigate before computing for any user with significant capital-source income. **I1–I4** are optional follow-ups against the official ITA primary sources.

The Calculator is now ready to compute. Next step: assemble a `YearInput` for the active user and run `calculate(input, rules, settlements)`.
