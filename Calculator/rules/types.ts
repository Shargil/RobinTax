// Year-versioned ITA rule tables — shared shape.
// One file per tax year (./2020.ts ... ./2025.ts) exports `const rules: YearRules`.
// See Calculator/decisions/ADR-002-year-versioned-rule-tables.md for the design.
//
// Provenance: parameters cite ITA publications by *key* into the centralized
// `citations` map. Source PDFs are archived under ./sources/<year>/.

export interface Citation {
  /** Canonical ITA page the artifact came from. */
  url: string;
  /** Relative path under ./sources/<year>/ (e.g. 'madrich-dnr-2024.pdf'). */
  source_file: string;
  /** Page reference for the big guide PDF (e.g. 'p. 47'). */
  page?: string;
  /** ISO date when the artifact was fetched and archived. */
  fetched: string;
  /** SHA256 of the archived file, for tamper-evidence. */
  sha256?: string;
  /** Optional free-text note (e.g. "covers brackets + ערך נ.ז."). */
  notes?: string;
}

/** A value with a pointer to which citation backs it. */
export interface Cited<T> {
  value: T;
  /** Key into YearRules.citations. */
  cite: string;
}

// ── Progressive ordinary-income brackets ────────────────────────────────────
export interface Bracket {
  /** Upper bound of this bracket in annual NIS, or `null` for the top bracket. */
  upTo: number | null;
  /** Marginal rate (0..1). */
  rate: number;
}

/** מס יסף — single-step surtax on top of the bracket schedule. */
export interface Surtax {
  threshold_nis: number;
  rate: number;
}

// ── Status-based credit-point rules ─────────────────────────────────────────
/**
 * §39A discharged-soldier credit. The credit is annualized: 2 pts/year for
 * "long" service (≥23 months male / ≥22 months female), 1 pt/year for shorter
 * (but ≥12 months) service. Within a tax year the credit is pro-rated by
 * eligible months in the 36-month window starting the month AFTER discharge.
 * Verified against Kolzchut worked example (July 2022 discharge → 7 months in 2025).
 */
export interface SoldierPointsRule {
  /** Annual entitlement when service ≥ long-service threshold (typically 2). */
  points_per_year_long_service: number;
  /** Annual entitlement when service is below long-service threshold but ≥ minimum (typically 1). */
  points_per_year_short_service: number;
  /** Long-service threshold (full months) for males. */
  min_service_months_male_long: number;
  /** Long-service threshold (full months) for females. */
  min_service_months_female_long: number;
  /** Minimum service months for any §39A eligibility. */
  min_service_months_eligibility: number;
  /** Length of the eligibility window in months, starting the month AFTER discharge. */
  eligibility_window_months: number;
}

export interface ImmigrantPointsSchedule {
  /** Points by year-since-aliyah, starting at index 0 = year 1. */
  by_year_from_aliyah: number[];
}

export interface DegreePointsRule {
  first_degree: number;
  second_degree: number;
  third_or_medical: number;
  eligible_years_post_completion: number;
}

export interface ChildrenPointsRule {
  /** Points per child by parent role and child age. Shape kept open per year. */
  schedule: Record<string, number>;
  notes?: string;
}

export interface DisabilityRule {
  /** Threshold disability % above which full ordinary-income exemption applies (§9(5)). */
  full_exemption_min_percent: number;
  /** Points granted at lesser thresholds, keyed by percent band ("50-89"). */
  partial_points: Record<string, number>;
}

// ── Credits & discounts ────────────────────────────────────────────────────
export interface DonationRule {
  /** Section 46 credit rate (typically 0.35 for individuals). */
  rate: number;
  /** Minimum total annual donation to qualify. */
  min_eligible_nis_per_year: number;
  /** Absolute NIS cap on the eligible donation base. */
  max_eligible_nis_absolute: number;
  /** Cap as a share of taxable income (typically 0.30). */
  max_eligible_share_of_taxable_income: number;
}

/**
 * §47 (deduction) + §45A (credit) for pension and life-insurance contributions.
 * Per Kolzchut + ITA circular 19/2004: §45A has TWO credit rates by sub-section —
 * §45A(a)(1) life-insurance premiums at 25% and §45A(a)(2) קופת גמל לקצבה at 35%.
 * §45A(d) `credit_base_ceiling_nis` is the shared ceiling on the contribution
 * BASE eligible for the credit (life-insurance applied first against the cap;
 * pension fund gets the remainder — conservative reading pending ITA 19/2004 fetch).
 */
export interface PensionRule {
  /** Employee deduction ceiling under §47(a)(1)(1) — work-income only (annual NIS). */
  employee_deduction_ceiling_nis: number;
  /** §45A(d) credit-base ceiling — shared between life-insurance and pension-fund deposits. */
  credit_base_ceiling_nis: number;
  /** §45A(a)(1) — life-insurance premium credit rate (typically 0.25). */
  credit_rate_life_insurance: number;
  /** §45A(a)(2) — קופת גמל לקצבה credit rate (typically 0.35). */
  credit_rate_pension_fund: number;
  /** Self-employed §47 ceiling. */
  self_employed_ceiling_nis: number;
}

export interface KerenHishtalmutRule {
  /** Salary ceiling above which employer deposits become taxable (§3(e)). */
  taxable_above_nis: number;
  /** Self-employed §17(5a) deduction ceiling. */
  self_employed_ceiling_nis: number;
}

/** Settlement-discount mechanics for the year (the list of settlements is in ./settlements/<year>.ts). */
export interface SettlementRule {
  /** Hard income ceiling on which the discount may apply (annual NIS). */
  max_income_ceiling_nis: number;
  /** Optional NIS floor; below this income the discount is zero. */
  min_income_floor_nis?: number;
}

// ── Separate-rate items ────────────────────────────────────────────────────
export interface SeparateRates {
  interest_linked: number;
  interest_nonlinked: number;
  dividend_normal: number;
  dividend_substantial: number;
  capital_gains: number;
  capital_gains_substantial: number;
}

// ── Cross-checks & filing ──────────────────────────────────────────────────
/**
 * Mandatory-filing triggers per תקנות מס הכנסה (פטור מהגשת דין וחשבון), תשמ"ח-1988.
 * Each numeric threshold is a separate trigger: ANY one being exceeded forces filing.
 * Note: aggregated multi-employer salary falls under `gross_salary_nis` — there is
 * NO separate lower "two-employers-without-תיאום-מס" sub-threshold in the regulation.
 * Verified against cpa-dray + Wikisource (2026-06-04).
 */
export interface MandatoryFilingThresholds {
  /** תוספת א — gross salary/business income (applies 2023–2026, frozen). */
  gross_salary_nis: number;
  /** §121B — all-source taxable income above this also triggers the 3% surtax + filing. */
  all_source_taxable_nis: number;
  /** תוספת ו — securities trading VOLUME (not income) above this. */
  securities_sales_volume_nis: number;
  /** תוספת ב — rental income above this. */
  rental_income_nis: number;
  /** תוספת ה — interest income above this. */
  interest_income_nis: number;
  /** תוספת ד — foreign-source income above this. */
  foreign_income_nis: number;
  /** Regulation 3(a)(7) — foreign-account balance threshold (per-year). */
  foreign_account_balance_nis: number;
  /** Regulation 3(a)(6) — foreign-asset value threshold (per-year). */
  foreign_asset_value_nis: number;
}

export interface BituachLeumiRates {
  /** NI + health tiers, ordered by upper bound. */
  tiers: Array<{ upTo: number | null; rate: number; label: string }>;
}

// ── Top-level year shape ───────────────────────────────────────────────────
export type SignOff = 'verified' | 'partial' | 'unverified';

export interface Verification {
  /** ISO date of the last full review. */
  last_verified: string;
  /** Reviewer name (matches `verified_by` in the YoY-diff sign-off). */
  verified_by: string;
  /** Whether the engine may use this year. `unverified`/`partial` block compute. */
  sign_off: SignOff;
  /** Reviewer eyeballed the structural diff vs the prior year. */
  yoy_diff_reviewed: boolean;
  /** Free-text reviewer notes. */
  notes?: string[];
}

export interface YearRules {
  tax_year: number;

  /** Centralized citations. Each parameter references one by key. */
  citations: Record<string, Citation>;

  brackets: Cited<Bracket[]>;
  surtax: Cited<Surtax>;
  point_value_annual: Cited<number>;
  point_value_monthly: Cited<number>;

  base_points: Cited<{ resident_male: number; resident_female: number }>;
  soldier_points: Cited<SoldierPointsRule>;
  immigrant_points: Cited<ImmigrantPointsSchedule>;
  degree_points: Cited<DegreePointsRule>;
  children_points: Cited<ChildrenPointsRule>;
  single_parent_points: Cited<number>;
  disability_points: Cited<DisabilityRule>;

  donation: Cited<DonationRule>;
  pension: Cited<PensionRule>;
  keren_hishtalmut: Cited<KerenHishtalmutRule>;

  /** Relative path from ./rules/ to the settlements file (e.g. 'settlements/2024.ts'). */
  settlements_file: string;
  settlement_rule: Cited<SettlementRule>;

  separate_rates: Cited<SeparateRates>;

  mandatory_filing: Cited<MandatoryFilingThresholds>;
  bituach_leumi_rates: Cited<BituachLeumiRates>;

  /** Reform/one-off notes that don't fit a structured field. */
  notes: string[];

  verification: Verification;
}
