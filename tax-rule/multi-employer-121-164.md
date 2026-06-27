---
section: 121/164
slug: multi-employer-121-164
status: active
last_verified: 2026-06-20
verified_against: [kolzchut]
---

# §121 / §164 — Annual reconciliation: multi-employer / partial-year over-withholding (תיאום מס / החזר בשל ריבוי מעבידים / לא עבדתי חלק מהשנה)

## TL;DR
PAYE withholding is calibrated monthly under the assumption that the current pay rate continues for all 12 months. Whenever that assumption is broken — multiple employers, sequential job change, or simply not working the full year — withholding overshoots the actual annual liability. The reconciliation runs through **one** §121 progressive-brackets pass over total annual income, with full annual credit points (נקודות זיכוי) applied once. The refund is the gap between aggregate withholding (sum of Form 106s) and the engine-computed liability. Two intake triggers feed the same mechanic: `job_change` (more than one employer) and `partial_year` (one employer, months_worked < 12, no replacement income). The user never sees the mechanic — they surface every Form 106 and the engine aggregates: sum the salary, sum the withholding, apply one bracket + credit-point pass over the total.

## The law
- **Statutes:**
  - Income Tax Ordinance §164 (`פקודת מס הכנסה — סעיף 164`) and the Income Tax Regulations (Withholding from Salary and Wages), 1993 — withholding obligation per payer, calibrated monthly.
  - Income Tax Ordinance §121 — the progressive bracket schedule that aggregate annual income is taxed against (annual, not monthly).
  - Income Tax Ordinance §§33A–36 — credit points are an **annual** entitlement; payers release them in monthly slices (point_value_annual / 12) over the months the employee works.
- **Hebrew name:** תיאום מס / החזר מס למחליפי מקום עבודה / ריבוי מעבידים / החזר מס למי שלא עבד חלק מהשנה.
- **Plain English:** The law taxes total annual income through one set of brackets, with one annual allotment of credit points; per-payer monthly withholding is just a prepayment. Prepayments overshoot when (a) credit points or low-bracket headroom are applied twice across payers, or (b) the employee earned for fewer than 12 months and the months they didn't work released no credit-point slices, so the annual entitlement goes partially unused at the payroll layer — both refunded on the annual return.

## Sources
| Source | Where | Last fetched | Role |
|---|---|---|---|
| Kolzchut — תיאום מס הכנסה | https://www.kolzchut.org.il/he/תיאום_מס_הכנסה | 2026-06-20 | Primary cross-check (multi-employer mechanic) |
| Kolzchut — החזר מס הכנסה | https://www.kolzchut.org.il/he/החזר_מס_הכנסה | 2026-06-20 | Primary cross-check (partial-year as refund trigger + 6-year window) |
| ITA personal area — 6-year bulk 106 list | https://www.gov.il/he/service/itc-106 | (live) | Source of the per-employer proof docs |

## Eligibility

**Gate (any one triggers the rule):**
1. Two or more employers in the tax year (overlapping OR sequential — including the "I switched jobs mid-year" case).
2. Concurrent income from a pension payer AND a salaried employer.
3. Concurrent income from two or more pension payers.
4. Concurrent income from salary AND a self-employed microenterprise (עסק זעיר) — note: business income is not coordinated, only the non-business sources.
5. Salary AND non-overlapping BTL benefits in the same tax year (e.g. maternity allowance + return-to-work, unemployment + return-to-work). Kolzchut explicitly calls this out.
6. **Single employer + partial year (`partial_year`).** One Form 106 in the year with `months_worked < 12` and no replacement income (no second 106, no BTL benefits, no pension). E.g. mid-year termination with no unemployment claimed, mid-year start without prior salary, sabbatical, year abroad, studies, post-discharge gap before first civilian job. The unused months' credit-point slices were never released by any payer — the annual entitlement is restored at reconciliation.

**For RobinTax v1 (salaried-only refunds):** triggers (1), (5), (6) are in scope. Triggers (2)–(4) are out of scope (osek and pension already gate elsewhere in the checklist).

## Edge cases
- **Sequential (not overlapping) still triggers** — kolzchut: "Worked Jan–June at Employer A, July–Dec at Employer B → requires coordination". Each employer applied full credit points and full low-bracket headroom for its slice — overshoot is guaranteed.
- **47% retroactive rate** — without coordination, the secondary employer applies 47% to all income from that source. This is the primary refund-driver mechanically: most wage-earners are far below the 47% bracket on aggregate income. Kolzchut precision: the 47% triggers when the employee declares multiple income sources on **Form 101** (the start-of-year payroll declaration) without producing a coordination certificate; if the employer applies it from mid-year, it back-applies from January of that year.
- **Form 101 is the mechanism, not a doc we collect** — the user files Form 101 with each employer once a year; the employer reflects its content in the withholding it reports on Form 106. Engine reads only the 106; Form 101 itself is informational.
- **6-year retroactive window** — refund claim via the annual return covers up to 6 tax years back from the year-end date. Aligned with the general ITA refund window, NOT a §164-specific rule.
- **No retroactive תיאום מס** — once the tax year ends, prospective coordination is closed. The only retroactive remedy is the annual return + refund mechanism, which is exactly what RobinTax does.
- **`חודשי עבודה < 12` on a 106 has two possible causes — disambiguated by intake.** Either (a) a second employer's 106 is missing (`job_change = yes`), or (b) the user genuinely didn't work the full year (`partial_year = yes`). Both produce refunds via the same §121 reconciliation, but the second-106 reconciliation should only fire when `partial_year ≠ yes` AND the 106 stack is incomplete. The `partial_year` intake flag is the silencer — if set, treat `months_worked < 12` as expected, not as a missing-doc signal.
- **Partial-year refund does not require a replacement income.** Even with one employer, no BTL benefits, and no other source, an annual refund is typical: payroll released only (months_worked / 12) of the annual credit-point allotment, while §121 brackets apply to the actual (lower-than-annualized) income. The two effects together usually push `ordinary_tax` below `total_withheld`. Worked example: `partial-year-single-employer`.
- **תיאום מס performed → smaller refund, not no refund** — even with a coordination certificate, real-world deductions still vary from the prospective estimate; an annual reconciliation refund may still be due, just smaller. Do not skip the year because the user reports they coordinated.
- **Stacking** — the multi-employer refund stacks with every other refund mechanism: soldier credit, settlement discount, donations, pension. The engine handles this by computing aggregate liability once over total income with all credits applied, then subtracting aggregate withholding.
- **Restrictions on online prospective coordination** (informational, not refund-affecting): users with 9+ income sources, kibbutz members, pre-קיבוע-זכויות retirees, or users who took an early-withdrawal-for-medical from a pension fund (קופת גמל) cannot use the online portal. Kibbutz already a disqualifier in [`Intake/checklist.md`](../Intake/checklist.md); other restrictions are out of v1 scope.
- **2026-specific:** ITA expanded brackets in 2026 and auto-extends 2026 coordination certificates from 2025. Affects prospective coordination only; the retroactive refund mechanic is unchanged.

## Formula
The engine has no §121/§164-specific helper function. The math is the default Calculator pipeline applied to a multi-element `employments[]` array:

```
gross_salary       = sum(emp.taxable_income       for emp in employments)
total_withheld     = sum(emp.withheld_tax         for emp in employments)
                   + sum(btl.withheld_tax         for btl in btl_benefits)
                   + investment_income.separate_withheld_tax

ordinary_tax       = applyBrackets(gross_salary - §47 deductions, rules.brackets)
                     - credit_amount  // credit_points_total × point_value_annual
                     - settlement_discount
                     - donation_credit
                     - pension_45a_credit
                     // clamped at 0

separate_tax       = separateRateTax(investment_income, rules.separate_rates)

total_tax_owed     = ordinary_tax + separate_tax
refund_or_owe_nis  = total_withheld - total_tax_owed
```

The "multi-employer" mechanic is structural: the aggregation happens at the `sum(...)` step. Per-employer credit points and per-employer bracket dispatch are **never** computed — the engine does one pass over the aggregate.

## Required documents
| Doc | Form # | Playbook |
|---|---|---|
| Form 106 — one per employer in the year (annual salary + withholding statement) | טופס 106 | [`Collector/documents/form-106.md`](../Collector/documents/form-106.md) |
| (optional informational) Coordination certificate, if user did תיאום מס prospectively | אישור תיאום מס | *not built — informational only; engine ignores* |

The Form 106 playbook explicitly handles the multi-employer case: the ITA personal area bulk-downloads every 106 the user's employers reported to שע"מ across the last 6 tax years. The user almost never needs to know how many employers they had — the bulk fetch enumerates them.

## Worked examples
Each row MUST have a 1:1 test in `Calculator/engine/calculate.test.ts` whose name contains the `[id]` tag. The drift test enforces this.

| id | Scenario | Expected |
|---|---|---|
| `multi-employer-aggregate` | M, soldier (36m IDF, Dec discharge prior year), settlement village, Employer A 60k / 6m / 12k withheld + Employer B 40k / 4m / 12k withheld | refund = 24k (full withholding; ordinary_tax clamped to 0 by stacked credits) |
| `multi-employer-mandatory-trigger` | Two employers @ 400k each (aggregate 800k > gross_salary_nis 700k fixture threshold) | mandatoryFilingTriggers fires the `gross salary` trigger over aggregate, not per-employer |
| `partial-year-single-employer` | M, no soldier/no settlement/no degree, **one** employer: 50k taxable / 6 months worked / 8k withheld, no replacement income | refund = 8k. Demonstrates: engine applies §121 brackets to actual annual income (50k, not annualized 100k), and applies full annual credit points (2.25 × 3,000 = 6,750) regardless of months_worked — so ordinary_tax clamps to 0 and full withholding refunds. |

## Intake
Read by the `intake` skill walker when the user checks **either** `job_change` or `partial_year` in [`Intake/checklist.md`](../Intake/checklist.md). Both gates feed the same §121 reconciliation; both record into the profile separately so downstream skills can distinguish the two causes when interpreting `months_worked < 12` on a 106.

### Gates
- **`job_change` — checklist label:** "החלפתי מקום עבודה". Primes UX for 2+ 106s per year.
- **`partial_year` — checklist label:** "לא עבדתי חלק מהשנה". Primes UX for legitimately fewer than 12 months on a single 106 (silences the "missing second 106" inference at the collection stage).

### Follow-ups
**None for either gate.** Everything the engine needs is on the Form 106(s) — per-employer salary, withholding, `months_worked`. The ITA personal area bulk-downloads every 106 reported to שע"מ across the user's filing years; asking the user *why* they didn't work the full year or *how many* employers they had only duplicates data we're about to enumerate from the 106 stack itself.

If `partial_year = yes` and the bulk 106 fetch returns multiple 106s, that's a productive surprise — log it; the user's mental model was wrong but the engine still computes correctly. If `job_change = yes` and only one 106 is found, the collector should reconcile (some employers don't report to שע"מ on time); if `partial_year = yes` and one 106 with `months_worked < 12` is found, **do not** prompt for a second — the user already explained the gap. This disambiguation belongs in [`Collector/documents/form-106.md`](../Collector/documents/form-106.md), not intake.

### Seeds
- Always seed `form-106` for every filing year in scope. This is the universal salaried doc — neither `job_change = yes` nor `partial_year = yes` adds a new doc; both only modulate Form 106's collection-stage UX (expect 2+ 106s vs expect <12 months on one 106).

### Profile keys
`job_change`, `partial_year`

## Implementation map
| Slice | File |
|---|---|
| Schema | [`Calculator/engine/calculate.ts`](../Calculator/engine/calculate.ts) — `employments[]` array on `CalculatorInput` (no dedicated rule interface) |
| Year values | **N/A** — this rule has no per-year monetary values. Brackets (§121) live on each year file as `rules.brackets`; that's a separate rule. The 47% max-withholding rate is hard-coded into §164 regulations, not a year-rule. |
| Math | [`Calculator/engine/calculate.ts`](../Calculator/engine/calculate.ts) — aggregation in the default `calculate()` pipeline; no per-rule helper |
| Tests | [`Calculator/engine/calculate.test.ts`](../Calculator/engine/calculate.test.ts) — `describe('calculate — golden case (multi-employer + settlement, Yam-like)')` and the multi-employer assertion in `describe('mandatoryFilingTriggers ...')` |
| Doc playbook | [`Collector/documents/form-106.md`](../Collector/documents/form-106.md) |
| Checklist entry | [`Intake/checklist.md`](../Intake/checklist.md) → `job_change` and `partial_year` (both map to this spec) |
| Profile keys | `<memory>/profile.md` → `job_change`, `partial_year` |
| Drift check | [`tax-rule/drift.test.ts`](drift.test.ts) — worked-example tags + checklist registration only (no year-values check) |

## Year values (canonical — N/A for this rule)
This rule has no rule-key-specific value table. The two numbers the mechanic touches both live elsewhere:

| Number | Where it lives | Why |
|---|---|---|
| §121 progressive brackets | `Calculator/rules/<YYYY>.ts` → `brackets` | Shared with every income-tax computation, not multi-employer-specific. |
| §164 maximum withholding rate (47%) | Statutory; never read by the engine | The engine reads what was *actually* withheld off each 106, not the statutory cap. The cap drives the user-side mechanic but doesn't enter our math. |

There is no `multi_employer` key on `YearRules`, by design.

## Year-over-year changes
| Year | Change |
|---|---|
| 2024 → 2025 | No statutory change to §121/§164 multi-employer mechanic. Bracket *numbers* shift (lives on `rules.brackets`, a separate rule). |
| 2025 → 2026 | ITA expanded brackets; auto-extends prospective coordination certificates. **Refund mechanic unchanged.** Affects user-side prospective coordination, not retroactive refund. |

## Open questions
- Pension-payer + salary multi-source case (out of scope for v1, but in-source on kolzchut) — if RobinTax v2 lifts the pension-payer disqualifier, this rule's spec needs a new follow-up branch and the engine needs a `pension_payments[]` field on `CalculatorInput`.
- Coordination certificate fetch playbook — not built. Currently the engine ignores whether prospective coordination happened; it just reads the actual withholding off the 106. If a future verifier wants to reconcile "expected withholding given coordination" vs "actual withholding", a playbook for fetching אישור תיאום מס would be needed.

## Verification log
- **2026-06-20** — Folded the `partial_year` (`לא עבדתי חלק מהשנה`) trigger into this spec per `/canonicalize-rule` (user choice: extend rather than create a new spec, since the mechanic — §121 annual brackets + §§33A–36 annual credit-point entitlement reconciled against monthly PAYE — is identical). Changes: (a) Title + TL;DR + Hebrew name extended to cover both triggers; (b) §§33A–36 added to the law list (annual credit-point entitlement is the partial-year refund driver); (c) Gate #6 added — single employer + months_worked < 12 + no replacement income; (d) Edge case "Partial-year months trigger the 'second 106' inference" rewritten — `partial_year` flag now silences the second-106 inference; (e) Edge case added — partial-year refund does not require a replacement income; (f) Worked example `partial-year-single-employer` added + tagged test in `calculate.test.ts`; (g) Intake section restructured for two gates (`job_change`, `partial_year`), both with no follow-ups; (h) Sources table adds kolzchut החזר מס הכנסה as secondary. Gap-passed against both kolzchut pages (תיאום מס + החזר מס הכנסה). No engine math change required — `calculate()` already applies full annual credit points and bracket-pass to actual annual income regardless of `months_worked`; the partial-year case was already correctly computed, just not surfaced in intake or worked examples. — Claude
- **2026-06-19c** — UX edit per user: dropped the `employer_count_band` follow-up. The ITA bulk 106 fetch enumerates every employer that reported to שע"מ; asking pre-fetch only duplicates data we're about to download. Any "we may have missed a 106" reconciliation belongs in `Collector/documents/form-106.md` (post-fetch), not intake. — Claude
- **2026-06-19b** — Gap-pass against kolzchut תיאום מס page (second read). Added: (1) Form 101 mechanism — the start-of-year multi-source declaration to each employer that, combined with no coordination certificate, triggers the 47% rate. Engine doesn't read Form 101; the 106 reflects what was withheld. (2) Clarified that the 47% retroactive-from-January application is mid-year-only, kicking in if the employer applies the rate part-way through the year. (3) Added early-withdrawal-medical to the online-portal restrictions list. No bottom-line value, formula, or eligibility branch changed → no code change, no test change. — Claude
- **2026-06-19** — Initial spec. Folded from `Calculator/rules/types.ts:148-153` docstring + `Calculator/engine/calculate.ts:599-601` comment (both on multi-employer aggregation under `gross_salary_nis`) + `Collector/documents/form-106.md` multi-employer caveat (חודשי עבודה < 12 → infer second 106). Gap-passed against kolzchut תיאום מס page. No conflicts found — engine already aggregates correctly; doc playbook already handles bulk 106 fetch. Spec is structurally adapted: no `## Year values` JSON block (rule has no per-year value table); drift test extended to check checklist registration and worked-example tags only. — Claude
