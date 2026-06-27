// Placeholder shape for unverified year files. NOT REAL ITA DATA.
//
// Every value passes schema invariants in `load.ts` so tooling (yoy-diff,
// validate) is exercisable, BUT `verification.sign_off: 'unverified'` blocks
// the engine. To verify a year, REPLACE the `makeScaffoldRules(<year>)` call
// in the year file with a literal `YearRules` object backed by archived PDFs.

import type { YearRules } from './types.ts';

export function makeScaffoldRules(tax_year: number): YearRules {
  return {
    tax_year,
    citations: {
      PLACEHOLDER: {
        url: 'TBD',
        source_file: `sources/${tax_year}/TBD.pdf`,
        fetched: 'TBD',
        notes: 'placeholder — replace with real ITA citation when verifying this year',
      },
    },
    brackets: {
      value: [
        { upTo: 84_120, rate: 0.10 },
        { upTo: 120_720, rate: 0.14 },
        { upTo: 193_800, rate: 0.20 },
        { upTo: 269_280, rate: 0.31 },
        { upTo: 560_280, rate: 0.35 },
        { upTo: 721_560, rate: 0.47 },
        { upTo: null, rate: 0.50 },
      ],
      cite: 'PLACEHOLDER',
    },
    surtax: { value: { threshold_nis: 721_560, rate: 0.03 }, cite: 'PLACEHOLDER' },
    point_value_annual: { value: 2_900, cite: 'PLACEHOLDER' },
    point_value_monthly: { value: 242, cite: 'PLACEHOLDER' },
    base_points: { value: { resident_male: 2.25, resident_female: 2.75 }, cite: 'PLACEHOLDER' },
    soldier_points: {
      value: {
        points_per_year_long_service: 2,
        points_per_year_short_service: 1,
        min_service_months_male_long: 23,
        min_service_months_female_long: 22,
        min_service_months_national_long: 24,
        min_service_months_eligibility: 12,
        eligibility_window_months: 36,
      },
      cite: 'PLACEHOLDER',
    },
    immigrant_points: { value: { by_year_from_aliyah: [3, 2, 1] }, cite: 'PLACEHOLDER' },
    degree_points: {
      value: { first_degree: 1, second_degree: 0.5, third_or_medical: 1, eligible_years_post_completion: 1 },
      cite: 'PLACEHOLDER',
    },
    children_points: { value: { schedule: {}, notes: 'placeholder' }, cite: 'PLACEHOLDER' },
    single_parent_points: { value: 1, cite: 'PLACEHOLDER' },
    disability_points: {
      value: { full_exemption_min_percent: 90, partial_points: {} },
      cite: 'PLACEHOLDER',
    },
    donation: {
      value: {
        rate: 0.35,
        min_eligible_nis_per_year: 200,
        max_eligible_nis_absolute: 9_000_000,
        max_eligible_share_of_taxable_income: 0.30,
      },
      cite: 'PLACEHOLDER',
    },
    pension: {
      value: {
        employee_deduction_ceiling_nis: 35_000,
        credit_base_ceiling_nis: 10_000,
        credit_rate_life_insurance: 0.25,
        credit_rate_pension_fund: 0.35,
        self_employed_ceiling_nis: 50_000,
      },
      cite: 'PLACEHOLDER',
    },
    keren_hishtalmut: {
      value: { taxable_above_nis: 15_000, self_employed_ceiling_nis: 18_960 },
      cite: 'PLACEHOLDER',
    },
    settlements_file: `settlements/${tax_year}.ts`,
    settlement_rule: { value: { max_income_ceiling_nis: 250_000 }, cite: 'PLACEHOLDER' },
    separate_rates: {
      value: {
        interest_linked: 0.25,
        interest_nonlinked: 0.15,
        dividend_normal: 0.25,
        dividend_substantial: 0.30,
        capital_gains: 0.25,
        capital_gains_substantial: 0.30,
      },
      cite: 'PLACEHOLDER',
    },
    mandatory_filing: {
      value: {
        gross_salary_nis: 723_000,
        all_source_taxable_nis: 721_560,
        securities_sales_volume_nis: 2_810_000,
        rental_income_nis: 375_000,
        interest_income_nis: 717_000,
        foreign_income_nis: 375_000,
        foreign_account_balance_nis: 1_500_000,
        foreign_asset_value_nis: 1_500_000,
      },
      cite: 'PLACEHOLDER',
    },
    bituach_leumi_rates: {
      value: { tiers: [{ upTo: null, rate: 0.12, label: 'placeholder' }] },
      cite: 'PLACEHOLDER',
    },
    notes: [
      `SCAFFOLD for tax year ${tax_year} — NOT REAL ITA DATA. ` +
        `Replace this entire file with a literal YearRules object backed by archived PDFs ` +
        `(see Calculator/rules/sources/${tax_year}/sources.md) before flipping sign_off to 'verified'.`,
    ],
    verification: {
      last_verified: 'never',
      verified_by: 'none',
      sign_off: 'unverified',
      yoy_diff_reviewed: false,
    },
  };
}
