// Thin engine skeleton — pure deterministic math against YearRules.
// LLMs do not call this. Each helper is independently exported + tested.
// The skill (`calc-refund`) wraps load-bearing inputs + eligibility judgments
// with `verifyClaim` from Calculator/verifier/ before they reach this layer.

import type {
  Bracket,
  DonationRule,
  ImmigrantPointsSchedule,
  PensionRule,
  SeparateRates,
  SettlementRule,
  SoldierPointsRule,
  Surtax,
  YearRules,
} from '../rules/types.ts';
import type { YearSettlements } from '../rules/settlements/types.ts';

// ── Input/output shapes ─────────────────────────────────────────────────────
export interface YearInput {
  tax_year: number;
  taxpayer: {
    gender: 'male' | 'female';
    aliyah_year?: number;
    discharged_soldier?: {
      service_months_full: number;
      service_months_partial: number;
      discharge_year: number;
      /** 1–12. Required for B1's eligible-months-in-tax-year calculation. */
      discharge_month: number;
    };
    degree?: { kind: 'first' | 'second' | 'third_or_medical'; completed_year: number };
    single_parent?: boolean;
    residency?: { settlement_he: string; qualifying_months: number };
  };
  employments: Array<{
    employer_id: string;
    taxable_income: number;
    withheld_tax: number;
    months_worked: number;
    pension_employee_deposit: number;
  }>;
  btl_benefits: Array<{ source: string; taxable_amount: number; withheld_tax: number }>;
  investment_income: {
    interest_linked: number;
    interest_nonlinked: number;
    dividend_normal: number;
    dividend_substantial: number;
    capital_gains: number;
    capital_gains_substantial: number;
    separate_withheld_tax: number;
  };
  donations_nis: number;
  /**
   * §45A credit base — deposits that earn the §45A rate credit (25% life / 35% pension).
   * Salaried payroll deposits (106 field 086/045) go here and ONLY here — they are NOT
   * §47-deductible. The fields are split by category for the rate split.
   */
  pension_45a_credit_base: {
    life_insurance_nis: number;
    pension_fund_nis: number;
  };
  /**
   * §47 deduction base — voluntary, beyond-payroll deposits that reduce taxable income.
   * Self-employed contributions (form 2605) and salaried-employee voluntary extras above
   * what payroll already deducts. For most salaried users this is {0, 0}.
   * Deposits placed here ALSO earn §45A credit on top — the engine adds the §47 amount
   * to the §45A pool before computing the rate credit. (Real-law: the same shekel can
   * earn both, since §47 and §45A are distinct mechanisms over the same contribution.)
   */
  pension_47_deduction_base: {
    life_insurance_nis: number;
    pension_fund_nis: number;
  };
  /** Optional mandatory-filing inputs not derivable from other fields. */
  filing_inputs?: {
    securities_sales_volume_nis?: number;
    rental_income_nis?: number;
    foreign_income_nis?: number;
    foreign_account_balance_nis?: number;
    foreign_asset_value_nis?: number;
  };
}

export interface YearResult {
  tax_year: number;
  refund_or_owe_nis: number;
  recommendation: 'file' | 'do-not-file' | 'mandatory-file' | 'uncertain';
  mandatory_triggers: string[];
  components: {
    taxable_ordinary: number;
    gross_tax: number;
    surtax: number;
    credit_points_total: number;
    credit_amount: number;
    donation_credit: number;
    settlement_discount: number;
    pension_credit: number;
    ordinary_tax: number;
    separate_tax: number;
    final_liability: number;
    total_withheld: number;
  };
  /**
   * Step-by-step trace of intermediate values for the walkthrough renderer.
   * Every field here is already computed in `components` or its helpers — `trace`
   * is the structured exposure so render.ts can show the math, not paraphrase it.
   */
  trace: YearResultTrace;
}

export interface YearResultTrace {
  income: {
    sources: Array<{ label: string; amount: number; kind: 'employment' | 'btl' }>;
    total: number;
  };
  withheld: {
    sources: Array<{ label: string; amount: number }>;
    total: number;
  };
  taxable: {
    gross: number;
    pension_section_47_deduction: number;
    taxable: number;
  };
  brackets: Array<{
    upTo: number | null;
    rate: number;
    widthApplied: number;
    taxAdded: number;
  }>;
  surtax: { threshold: number; rate: number; appliedTo: number; tax: number };
  credit_points: {
    base: number;
    soldier: number;
    immigrant: number;
    degree: number;
    single_parent: number;
    total: number;
    point_value_annual: number;
    credit_amount: number;
  };
  pension_section_45a: {
    deposit_life_insurance: number;
    deposit_pension_fund: number;
    credit_base_ceiling: number;
    life_eligible: number;
    pension_eligible: number;
    rate_life_insurance: number;
    rate_pension_fund: number;
    credit: number;
  };
  settlement: {
    settlement_he: string;
    eligible_rate: number;
    eligible_ceiling: number;
    qualifying_months: number;
    eligible_income: number;
    months_share: number;
    discount: number;
  } | null;
  donation: {
    donated: number;
    rate: number;
    abs_cap: number;
    share_cap: number;
    eligible: number;
    credit: number;
  } | null;
  recommendation: {
    liability: number;
    withheld: number;
    refund_or_owe: number;
    triggers: string[];
  };
}

// ── Pure helpers ────────────────────────────────────────────────────────────

export interface BracketsTrace {
  tax: number;
  applied: Array<{ upTo: number | null; rate: number; widthApplied: number; taxAdded: number }>;
}

/** Apply progressive brackets, returning the per-bracket detail used for the walkthrough. */
export function applyBracketsTraced(taxable: number, brackets: Bracket[]): BracketsTrace {
  const applied: BracketsTrace['applied'] = [];
  if (taxable <= 0) {
    for (const b of brackets) applied.push({ upTo: b.upTo, rate: b.rate, widthApplied: 0, taxAdded: 0 });
    return { tax: 0, applied };
  }
  let tax = 0;
  let prevTop = 0;
  let done = false;
  for (const b of brackets) {
    const top = b.upTo ?? Infinity;
    const widthApplied = done ? 0 : Math.max(0, Math.min(taxable, top) - prevTop);
    const taxAdded = widthApplied * b.rate;
    tax += taxAdded;
    applied.push({ upTo: b.upTo, rate: b.rate, widthApplied, taxAdded });
    if (!done && taxable <= top) done = true;
    prevTop = top;
  }
  return { tax, applied };
}

/** Apply progressive brackets. Pure. Thin wrapper over `applyBracketsTraced`. */
export function applyBrackets(taxable: number, brackets: Bracket[]): number {
  return applyBracketsTraced(taxable, brackets).tax;
}

export interface SurtaxTrace {
  tax: number;
  threshold: number;
  rate: number;
  appliedTo: number;
}

/** מס יסף — traced variant. */
export function applySurtaxTraced(taxable: number, surtax: Surtax): SurtaxTrace {
  const appliedTo = Math.max(0, taxable - surtax.threshold_nis);
  return { tax: appliedTo * surtax.rate, threshold: surtax.threshold_nis, rate: surtax.rate, appliedTo };
}

/** מס יסף — single-step surtax on income above the threshold. */
export function applySurtax(taxable: number, surtax: Surtax): number {
  return applySurtaxTraced(taxable, surtax).tax;
}

/**
 * Soldier credit points for the tax year — §39A.
 *
 * Formula (per Kolzchut deep-dive, verified worked-example):
 *   annual_entitlement = 2 if (male && service ≥ 23) || (female && service ≥ 22), else 1
 *   per_month_rate     = annual_entitlement / 12
 *   eligible_months    = count of months in this tax year that fall within
 *                        the 36-month window starting the MONTH AFTER discharge
 *   credit             = eligible_months × per_month_rate
 *
 * Worked example: male, July 2022 discharge, 30 months service:
 *   window = Aug 2022 – Jul 2025 (36 months inclusive)
 *   tax_year 2025 → eligible_months = 7 (Jan–Jul) → 7 × (2/12) = 7/6 ≈ 1.167 pts
 */
export function soldierPoints(
  tax_year: number,
  gender: 'male' | 'female',
  input: NonNullable<YearInput['taxpayer']['discharged_soldier']>,
  rule: SoldierPointsRule,
): number {
  const total_service = input.service_months_full + input.service_months_partial;
  if (total_service < rule.min_service_months_eligibility) return 0;

  const long_threshold =
    gender === 'female' ? rule.min_service_months_female_long : rule.min_service_months_male_long;
  const annual_entitlement =
    total_service >= long_threshold ? rule.points_per_year_long_service : rule.points_per_year_short_service;
  const per_month = annual_entitlement / 12;

  // Window: starts the MONTH AFTER discharge; lasts eligibility_window_months (inclusive).
  // Month index: year * 12 + (month - 1). discharge_month is 1–12.
  const discharge_idx = input.discharge_year * 12 + (input.discharge_month - 1);
  const window_start = discharge_idx + 1;
  const window_end = window_start + rule.eligibility_window_months - 1;

  const year_start = tax_year * 12;
  const year_end = year_start + 11;

  const overlap_start = Math.max(year_start, window_start);
  const overlap_end = Math.min(year_end, window_end);
  const eligible_months = Math.max(0, overlap_end - overlap_start + 1);

  return eligible_months * per_month;
}

/** Immigrant credit points for the tax year, based on years since aliyah. */
export function immigrantPoints(tax_year: number, aliyah_year: number, schedule: ImmigrantPointsSchedule): number {
  const idx = tax_year - aliyah_year;
  if (idx < 0) return 0;
  return schedule.by_year_from_aliyah[idx] ?? 0;
}

/** Settlement discount (יישוב מזכה). Pro-rated by qualifying months / 12. */
export function settlementDiscount(
  input: NonNullable<YearInput['taxpayer']['residency']>,
  settlements: YearSettlements,
  rule: SettlementRule,
  taxable_ordinary: number,
): {
  discount_nis: number;
  eligible_rate: number;
  eligible_ceiling: number;
  eligible_income: number;
  months_share: number;
  qualifying_months: number;
  matched: boolean;
} {
  const found = settlements.settlements.find((s) => s.name_he === input.settlement_he);
  if (!found) {
    return {
      discount_nis: 0,
      eligible_rate: 0,
      eligible_ceiling: 0,
      eligible_income: 0,
      months_share: 0,
      qualifying_months: input.qualifying_months,
      matched: false,
    };
  }
  const ceiling = found.income_ceiling_nis ?? rule.max_income_ceiling_nis;
  const eligibleIncome = Math.min(taxable_ordinary, ceiling);
  const monthsShare = Math.min(12, Math.max(0, input.qualifying_months)) / 12;
  const discount = eligibleIncome * found.rate * monthsShare;
  return {
    discount_nis: discount,
    eligible_rate: found.rate,
    eligible_ceiling: ceiling,
    eligible_income: eligibleIncome,
    months_share: monthsShare,
    qualifying_months: input.qualifying_months,
    matched: true,
  };
}

export interface DonationTrace {
  credit: number;
  donated: number;
  rate: number;
  abs_cap: number;
  share_cap: number;
  eligible: number;
}

/** Donation §46 credit — traced variant. */
export function donationCreditTraced(donations_nis: number, taxable_ordinary: number, rule: DonationRule): DonationTrace {
  const abs_cap = rule.max_eligible_nis_absolute;
  const share_cap = taxable_ordinary * rule.max_eligible_share_of_taxable_income;
  if (donations_nis < rule.min_eligible_nis_per_year) {
    return { credit: 0, donated: donations_nis, rate: rule.rate, abs_cap, share_cap, eligible: 0 };
  }
  const cap = Math.min(abs_cap, share_cap);
  const eligible = Math.min(donations_nis, cap);
  return { credit: eligible * rule.rate, donated: donations_nis, rate: rule.rate, abs_cap, share_cap, eligible };
}

/** Donation §46 credit. Capped by absolute NIS and share of taxable income. */
export function donationCredit(donations_nis: number, taxable_ordinary: number, rule: DonationRule): number {
  return donationCreditTraced(donations_nis, taxable_ordinary, rule).credit;
}

/** Shape of a §45A credit base — same as either of the two `YearInput` pools. */
export interface PensionDepositPool {
  life_insurance_nis: number;
  pension_fund_nis: number;
}

/**
 * §45A credit — split by deposit category:
 *   §45A(a)(1) life-insurance premium → 25%
 *   §45A(a)(2) קופת גמל לקצבה        → 35%
 * §45A(d) `credit_base_ceiling_nis` is the SHARED ceiling on the contribution base.
 * Conservative reading (pending ITA 19/2004 fetch): life-insurance applied first
 * against the cap, pension fund gets the remainder.
 *
 * The caller is responsible for assembling the combined §45A pool (payroll 086/045
 * + voluntary §47 contributions); both qualify for §45A. See `calculate()`.
 */
export function pensionCredit(deposit: PensionDepositPool, rule: PensionRule): number {
  return pensionCreditTraced(deposit, rule).credit;
}

export interface PensionCreditTrace {
  credit: number;
  deposit_life_insurance: number;
  deposit_pension_fund: number;
  credit_base_ceiling: number;
  life_eligible: number;
  pension_eligible: number;
  rate_life_insurance: number;
  rate_pension_fund: number;
}

/** Pension §45A credit — traced variant. Same math as `pensionCredit`, exposes intermediates. */
export function pensionCreditTraced(
  deposit: PensionDepositPool,
  rule: PensionRule,
): PensionCreditTrace {
  const life_eligible = Math.min(deposit.life_insurance_nis, rule.credit_base_ceiling_nis);
  const remaining_cap = Math.max(0, rule.credit_base_ceiling_nis - life_eligible);
  const pension_eligible = Math.min(deposit.pension_fund_nis, remaining_cap);
  const credit = life_eligible * rule.credit_rate_life_insurance + pension_eligible * rule.credit_rate_pension_fund;
  return {
    credit,
    deposit_life_insurance: deposit.life_insurance_nis,
    deposit_pension_fund: deposit.pension_fund_nis,
    credit_base_ceiling: rule.credit_base_ceiling_nis,
    life_eligible,
    pension_eligible,
    rate_life_insurance: rule.credit_rate_life_insurance,
    rate_pension_fund: rule.credit_rate_pension_fund,
  };
}

/** Separate-rate tax on investment income (flat rates, not through brackets). */
export function separateRateTax(income: YearInput['investment_income'], rates: SeparateRates): number {
  return (
    income.interest_linked * rates.interest_linked +
    income.interest_nonlinked * rates.interest_nonlinked +
    income.dividend_normal * rates.dividend_normal +
    income.dividend_substantial * rates.dividend_substantial +
    income.capital_gains * rates.capital_gains +
    income.capital_gains_substantial * rates.capital_gains_substantial
  );
}

// ── Top-level pipeline ──────────────────────────────────────────────────────
export function calculate(input: YearInput, rules: YearRules, settlements: YearSettlements): YearResult {
  if (input.tax_year !== rules.tax_year) {
    throw new Error(`tax_year mismatch: input=${input.tax_year} rules=${rules.tax_year}`);
  }

  // STEP 1 — Aggregate ordinary income (− allowable deductions).
  // §47 deduction reads ONLY the §47 pool. Salaried payroll deposits (which go in
  // the §45A pool) are NOT §47-deductible — that was the pre-2026-06-06 coupling bug.
  const grossOrdinary =
    input.employments.reduce((s, e) => s + e.taxable_income, 0) +
    input.btl_benefits.reduce((s, b) => s + b.taxable_amount, 0);
  const total_47_deposits =
    input.pension_47_deduction_base.life_insurance_nis + input.pension_47_deduction_base.pension_fund_nis;
  const pension_deduction = Math.min(
    total_47_deposits,
    rules.pension.value.employee_deduction_ceiling_nis,
  );
  const taxable_ordinary = Math.max(0, grossOrdinary - pension_deduction);

  // STEP 2 — Progressive brackets + surtax.
  const bracketsTrace = applyBracketsTraced(taxable_ordinary, rules.brackets.value);
  const gross_tax = bracketsTrace.tax;
  const surtaxTrace = applySurtaxTraced(taxable_ordinary, rules.surtax.value);
  const surtax = surtaxTrace.tax;

  // STEP 3 — Credit points by status.
  const base =
    input.taxpayer.gender === 'female'
      ? rules.base_points.value.resident_female
      : rules.base_points.value.resident_male;
  const soldier = input.taxpayer.discharged_soldier
    ? soldierPoints(
        input.tax_year,
        input.taxpayer.gender,
        input.taxpayer.discharged_soldier,
        rules.soldier_points.value,
      )
    : 0;
  const immigrant = input.taxpayer.aliyah_year
    ? immigrantPoints(input.tax_year, input.taxpayer.aliyah_year, rules.immigrant_points.value)
    : 0;
  const degree = input.taxpayer.degree ? rules.degree_points.value.first_degree : 0; // simplified
  const single_parent = input.taxpayer.single_parent ? rules.single_parent_points.value : 0;
  const credit_points_total = base + soldier + immigrant + degree + single_parent;
  const point_value_annual = rules.point_value_annual.value;
  const credit_amount = credit_points_total * point_value_annual;

  // STEP 4 — Status-based credits & discounts.
  const donationTrace = donationCreditTraced(input.donations_nis, taxable_ordinary, rules.donation.value);
  const donation_credit = donationTrace.credit;
  const settlement = input.taxpayer.residency
    ? settlementDiscount(input.taxpayer.residency, settlements, rules.settlement_rule.value, taxable_ordinary)
    : null;
  const settlement_discount = settlement?.discount_nis ?? 0;
  // §45A credit reads BOTH pools — the §47-deductible voluntary deposit ALSO earns
  // the §45A rate credit on the same shekel (the two mechanisms are independent in
  // real law). The shared §45A base ceiling caps the sum.
  const pension_45a_pool: PensionDepositPool = {
    life_insurance_nis:
      input.pension_45a_credit_base.life_insurance_nis + input.pension_47_deduction_base.life_insurance_nis,
    pension_fund_nis:
      input.pension_45a_credit_base.pension_fund_nis + input.pension_47_deduction_base.pension_fund_nis,
  };
  const pensionTrace = pensionCreditTraced(pension_45a_pool, rules.pension.value);
  const pension_credit = pensionTrace.credit;

  // STEP 5 — Net ordinary tax (clamped at 0).
  const ordinary_tax = Math.max(
    0,
    gross_tax + surtax - credit_amount - donation_credit - settlement_discount - pension_credit,
  );

  // STEP 6 — Separate-rate items.
  const separate_tax = separateRateTax(input.investment_income, rules.separate_rates.value);

  // STEP 7 — Refund vs withheld.
  const final_liability = ordinary_tax + separate_tax;
  const employmentWithheld = input.employments.map((e) => ({
    label: `employer ${e.employer_id}`,
    amount: e.withheld_tax,
  }));
  const btlWithheld = input.btl_benefits.map((b) => ({ label: b.source, amount: b.withheld_tax }));
  const investmentWithheld =
    input.investment_income.separate_withheld_tax > 0
      ? [{ label: 'investment (separate-rate)', amount: input.investment_income.separate_withheld_tax }]
      : [];
  const withheldSources = [...employmentWithheld, ...btlWithheld, ...investmentWithheld];
  const total_withheld = withheldSources.reduce((s, w) => s + w.amount, 0);
  const refund_or_owe_nis = total_withheld - final_liability;

  // STEP 8 — Recommendation (with mandatory-filing detection).
  const mandatory_triggers = mandatoryFilingTriggers(input, rules);
  const tol = 1; // ±1 ₪ "zero band"
  const recommendation: YearResult['recommendation'] =
    refund_or_owe_nis > tol
      ? 'file'
      : mandatory_triggers.length > 0
        ? 'mandatory-file'
        : refund_or_owe_nis < -tol
          ? 'do-not-file'
          : 'uncertain';

  // STEP 9 — Assemble trace for the walkthrough renderer. All values already computed above.
  const incomeSources: YearResultTrace['income']['sources'] = [
    ...input.employments.map((e) => ({
      label: `employer ${e.employer_id}`,
      amount: e.taxable_income,
      kind: 'employment' as const,
    })),
    ...input.btl_benefits.map((b) => ({
      label: b.source,
      amount: b.taxable_amount,
      kind: 'btl' as const,
    })),
  ];

  const trace: YearResultTrace = {
    income: { sources: incomeSources, total: grossOrdinary },
    withheld: { sources: withheldSources, total: total_withheld },
    taxable: {
      gross: grossOrdinary,
      pension_section_47_deduction: pension_deduction,
      taxable: taxable_ordinary,
    },
    brackets: bracketsTrace.applied,
    surtax: surtaxTrace,
    credit_points: {
      base,
      soldier,
      immigrant,
      degree,
      single_parent,
      total: credit_points_total,
      point_value_annual,
      credit_amount,
    },
    pension_section_45a: pensionTrace,
    settlement: settlement
      ? {
          settlement_he: input.taxpayer.residency!.settlement_he,
          eligible_rate: settlement.eligible_rate,
          eligible_ceiling: settlement.eligible_ceiling,
          qualifying_months: settlement.qualifying_months,
          eligible_income: settlement.eligible_income,
          months_share: settlement.months_share,
          discount: settlement.discount_nis,
        }
      : null,
    donation: input.donations_nis > 0 ? donationTrace : null,
    recommendation: {
      liability: final_liability,
      withheld: total_withheld,
      refund_or_owe: refund_or_owe_nis,
      triggers: mandatory_triggers,
    },
  };

  return {
    tax_year: input.tax_year,
    refund_or_owe_nis,
    recommendation,
    mandatory_triggers,
    components: {
      taxable_ordinary,
      gross_tax,
      surtax,
      credit_points_total,
      credit_amount,
      donation_credit,
      settlement_discount,
      pension_credit,
      ordinary_tax,
      separate_tax,
      final_liability,
      total_withheld,
    },
    trace,
  };
}

/**
 * Mandatory-filing triggers per תקנות פטור מהגשת דין וחשבון. Returns one human
 * label per trigger that fires. Multi-employer is captured by aggregate salary
 * vs gross_salary_nis — no separate sub-threshold exists in the regulation.
 */
export function mandatoryFilingTriggers(input: YearInput, rules: YearRules): string[] {
  const triggers: string[] = [];
  const mf = rules.mandatory_filing.value;

  // 1) Gross salary/work income (aggregated across all employers).
  const gross_salary = input.employments.reduce((s, e) => s + e.taxable_income, 0);
  if (gross_salary > mf.gross_salary_nis) {
    triggers.push(`gross salary ${gross_salary.toLocaleString()} > ${mf.gross_salary_nis.toLocaleString()} NIS`);
  }

  // 2) All-source taxable income (§121B trigger — same threshold as surtax).
  const all_source =
    gross_salary +
    input.btl_benefits.reduce((s, b) => s + b.taxable_amount, 0) +
    input.investment_income.interest_linked +
    input.investment_income.interest_nonlinked +
    input.investment_income.dividend_normal +
    input.investment_income.dividend_substantial +
    input.investment_income.capital_gains +
    input.investment_income.capital_gains_substantial;
  if (all_source > mf.all_source_taxable_nis) {
    triggers.push(`all-source taxable ${all_source.toLocaleString()} > ${mf.all_source_taxable_nis.toLocaleString()} NIS`);
  }

  // 3) Interest income alone — תוספת ה.
  const interest = input.investment_income.interest_linked + input.investment_income.interest_nonlinked;
  if (interest > mf.interest_income_nis) {
    triggers.push(`interest income ${interest.toLocaleString()} > ${mf.interest_income_nis.toLocaleString()} NIS`);
  }

  // 4-8) Optional inputs the engine doesn't otherwise track.
  const fi = input.filing_inputs ?? {};
  if ((fi.securities_sales_volume_nis ?? 0) > mf.securities_sales_volume_nis) {
    triggers.push(`securities sales volume > ${mf.securities_sales_volume_nis.toLocaleString()} NIS`);
  }
  if ((fi.rental_income_nis ?? 0) > mf.rental_income_nis) {
    triggers.push(`rental income > ${mf.rental_income_nis.toLocaleString()} NIS`);
  }
  if ((fi.foreign_income_nis ?? 0) > mf.foreign_income_nis) {
    triggers.push(`foreign-source income > ${mf.foreign_income_nis.toLocaleString()} NIS`);
  }
  if ((fi.foreign_account_balance_nis ?? 0) > mf.foreign_account_balance_nis) {
    triggers.push(`foreign account balance > ${mf.foreign_account_balance_nis.toLocaleString()} NIS`);
  }
  if ((fi.foreign_asset_value_nis ?? 0) > mf.foreign_asset_value_nis) {
    triggers.push(`foreign asset value > ${mf.foreign_asset_value_nis.toLocaleString()} NIS`);
  }

  return triggers;
}
