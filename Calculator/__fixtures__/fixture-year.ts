// Synthetic, legally-shaped YearRules used by load + engine tests.
// NOT a real Israeli tax year — `tax_year: 9999` keeps it from being mistaken for one.
// Values are chosen so hand-computed golden cases are obvious.

import type { YearRules } from '../rules/types.ts';
import type { YearSettlements } from '../rules/settlements/types.ts';

export function makeFixtureYear(overrides: Partial<YearRules> = {}): YearRules {
  const base: YearRules = {
    tax_year: 9999,
    citations: {
      'fixture-guide': {
        url: 'https://example.invalid/guide-9999',
        source_file: 'sources/9999/fixture-guide.pdf',
        fetched: '9999-01-01',
        notes: 'synthetic fixture — not a real ITA publication',
      },
    },
    brackets: {
      value: [
        { upTo: 100_000, rate: 0.10 },
        { upTo: 200_000, rate: 0.20 },
        { upTo: null, rate: 0.30 },
      ],
      cite: 'fixture-guide',
    },
    surtax: { value: { threshold_nis: 10_000_000, rate: 0.03 }, cite: 'fixture-guide' },
    point_value_annual: { value: 3_000, cite: 'fixture-guide' },
    point_value_monthly: { value: 250, cite: 'fixture-guide' },
    base_points: { value: { resident_male: 2.25, resident_female: 2.75 }, cite: 'fixture-guide' },
    soldier_points: {
      value: {
        points_per_year_long_service: 2,
        points_per_year_short_service: 1,
        min_service_months_male_long: 23,
        min_service_months_female_long: 22,
        min_service_months_eligibility: 12,
        eligibility_window_months: 36,
      },
      cite: 'fixture-guide',
    },
    immigrant_points: { value: { by_year_from_aliyah: [3, 2, 1] }, cite: 'fixture-guide' },
    degree_points: {
      value: { first_degree: 0.5, second_degree: 1, third_or_medical: 1, eligible_years_post_completion: 1 },
      cite: 'fixture-guide',
    },
    children_points: { value: { schedule: {}, notes: 'fixture' }, cite: 'fixture-guide' },
    single_parent_points: { value: 1, cite: 'fixture-guide' },
    disability_points: {
      value: { full_exemption_min_percent: 90, partial_points: {} },
      cite: 'fixture-guide',
    },
    donation: {
      value: {
        rate: 0.35,
        min_eligible_nis_per_year: 200,
        max_eligible_nis_absolute: 9_000_000,
        max_eligible_share_of_taxable_income: 0.30,
      },
      cite: 'fixture-guide',
    },
    pension: {
      value: {
        employee_deduction_ceiling_nis: 35_000,
        credit_base_ceiling_nis: 10_000,
        credit_rate_life_insurance: 0.25,
        credit_rate_pension_fund: 0.35,
        self_employed_ceiling_nis: 50_000,
      },
      cite: 'fixture-guide',
    },
    keren_hishtalmut: {
      value: { taxable_above_nis: 15_000, self_employed_ceiling_nis: 5_000 },
      cite: 'fixture-guide',
    },
    settlements_file: 'settlements/9999.ts',
    settlement_rule: { value: { max_income_ceiling_nis: 250_000 }, cite: 'fixture-guide' },
    separate_rates: {
      value: {
        interest_linked: 0.25,
        interest_nonlinked: 0.15,
        dividend_normal: 0.25,
        dividend_substantial: 0.30,
        capital_gains: 0.25,
        capital_gains_substantial: 0.30,
      },
      cite: 'fixture-guide',
    },
    mandatory_filing: {
      value: {
        gross_salary_nis: 700_000,
        all_source_taxable_nis: 700_000,
        securities_sales_volume_nis: 2_000_000,
        rental_income_nis: 300_000,
        interest_income_nis: 500_000,
        foreign_income_nis: 300_000,
        foreign_account_balance_nis: 1_000_000,
        foreign_asset_value_nis: 1_000_000,
      },
      cite: 'fixture-guide',
    },
    bituach_leumi_rates: {
      value: { tiers: [{ upTo: null, rate: 0.12, label: 'fixture-flat' }] },
      cite: 'fixture-guide',
    },
    notes: ['synthetic fixture — not a real Israeli tax year'],
    verification: {
      last_verified: '9999-01-01',
      verified_by: 'test',
      sign_off: 'verified',
      yoy_diff_reviewed: true,
    },
  };
  return { ...base, ...overrides };
}

export function makeFixtureSettlements(): YearSettlements {
  return {
    tax_year: 9999,
    cite: 'fixture-guide',
    settlements: [
      { name_he: 'TestVillage', council_he: 'TestCouncil', rate: 0.10 },
      { name_he: 'OtherVillage', council_he: 'TestCouncil', rate: 0.20 },
    ],
  };
}
