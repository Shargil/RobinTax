// Tax year 2025 — populated 2026-06-03 from archived ITA + BTL sources in
// ./sources/2025/. The Arrangements Law froze indexation of NIS amounts in
// tax law for 2025-2027 (gov.il sa161224-4), so most values are identical to
// 2024 by construction. Differences from 2024 are flagged inline.
//
// See ./sources/2025/sources.md for the SHA256-stamped manifest.

import type { YearRules } from './types.ts';

export const rules: YearRules = {
  tax_year: 2025,

  citations: {
    'madrich-2025': {
      url: 'https://www.gov.il/BlobFolder/generalpage/income-tax-guide-knowyourright/he/Guides_IncomeTax_da-2025.pdf',
      source_file: 'sources/2025/guide-individuals-2025.pdf',
      fetched: '2026-06-03',
      sha256: '5012033e55e0c415a3b50a797acb2d5b5ddae06e2bdbe16c466c78baec9960d0',
      notes: 'Primary: annual filing guide "דע זכויותיך וחובותיך 2025".',
    },
    'annual-deductions-2025': {
      url: 'https://www.gov.il/BlobFolder/generalpage/income-tax-annual-deductions-booklet/he/generalInformation_income-tax-yearly-deductions-booklet_yearly-deductions-booklet-2025.pdf',
      source_file: 'sources/2025/annual-deductions-2025.pdf',
      fetched: '2026-06-03',
      sha256: 'c86ad63b6ed736bb8429dcc7049f94533325dc27a26267aa8fd58590224e7066',
      notes: 'Annual deductions booklet 2025 — two-source check vs madrich-2025.',
    },
    'monthly-deductions-2025': {
      url: 'https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2025.pdf',
      source_file: 'sources/2025/monthly-deductions-2025.pdf',
      fetched: '2026-06-03',
      sha256: '41496dd374f5e3a397b17b5dfdfd2055537b66bac4c2fc4543d544406522fd73',
    },
    'settlements-procedure-2025': {
      url: 'https://www.gov.il/BlobFolder/policy/procedures-060125/he/IncomeTax_procedures-060125.pdf',
      source_file: 'sources/2025/settlements-procedure-2025.pdf',
      fetched: '2026-06-03',
      sha256: '48a5debf06ea4810a7badb34ed855d269db288a68b633908e786d19f589a0ce9',
      notes: '2025 ITA procedure for issuing settlement residency certifications — confirms 2025 program continues.',
    },
    'btl-rates-2025': {
      url: 'https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/שינוי בתשלום דמי ביטוח לאומי ודמי ביטוח בריאות לשנת 2025 החל מחודש פברואר 2025.pdf',
      source_file: 'sources/2025/btl-rates-2025-feb.pdf',
      fetched: '2026-06-03',
      sha256: '38cca39e75ad02cbd27aa003008fc8f3cdab673f6fbcb07e8bd0ebd97b3aeb48',
      notes: 'Feb-2025 BTL rate notice supersedes the Jan-2025 version for most cases.',
    },
    'kolzchut-section-11': {
      url: 'https://www.kolzchut.org.il/he/זיכוי_ממס_הכנסה_לתושבים_בפריפריה',
      source_file: 'sources/_shared/kolzchut-section-11-periphery.html',
      fetched: '2026-06-05',
      sha256: '11ba0b2fa7b92e764d2ed440e5356d05ed16b3168524d986242424a174673401',
      notes: '§11 settlement benefit: confirms linear pro-rata by qualifying months + 12-month consecutive-residency floor. Anchors settlementDiscount() pro-rata behaviour.',
    },
  },

  // Brackets: confirmed identical to 2024 at annual-deductions-2025 lines 379-384.
  brackets: {
    value: [
      { upTo: 84_120,  rate: 0.10 },
      { upTo: 120_720, rate: 0.14 },
      { upTo: 193_800, rate: 0.20 },
      { upTo: 269_280, rate: 0.31 },
      { upTo: 560_280, rate: 0.35 },
      { upTo: null,    rate: 0.47 },
    ],
    cite: 'annual-deductions-2025',
  },
  // Surtax — unchanged 721,560 @ 3% under the indexation freeze.
  surtax: { value: { threshold_nis: 721_560, rate: 0.03 }, cite: 'madrich-2025' },

  // Point value: 2,904 NIS/year. Confirmed annual-deductions-2025 line 434 — unchanged.
  point_value_annual:  { value: 2_904, cite: 'annual-deductions-2025' },
  point_value_monthly: { value: 242,   cite: 'annual-deductions-2025' },

  base_points: {
    value: { resident_male: 2.25, resident_female: 2.75 },
    cite: 'madrich-2025',
  },

  // §39A — same as 2024 (statutory rule; not affected by indexation).
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
    cite: 'madrich-2025',
  },

  immigrant_points: { value: { by_year_from_aliyah: [3, 2, 1] }, cite: 'madrich-2025' },

  // Canonical spec: tax-rule/degree-40c-40d.md
  degree_points: {
    value: { first_degree: 1, second_degree: 0.5, third_or_medical: 1, eligible_years_post_completion: 1 },
    cite: 'madrich-2025',
  },

  children_points: {
    value: {
      schedule: { born_in_year: 1, age_1_to_2: 2, age_3_to_5: 1 },
      notes: 'Reform per ספר חוקים 3048 in effect for 2024-2025.',
    },
    cite: 'madrich-2025',
  },

  single_parent_points: { value: 1, cite: 'madrich-2025' },

  disability_points: {
    value: { full_exemption_min_percent: 89, partial_points: {} },
    cite: 'madrich-2025',
  },

  // Donation §46 — unchanged under indexation freeze. annual-deductions-2025 lines 504-509.
  donation: {
    value: {
      rate: 0.35,
      min_eligible_nis_per_year: 207,
      max_eligible_nis_absolute: 10_354_816,
      max_eligible_share_of_taxable_income: 0.30,
    },
    cite: 'annual-deductions-2025',
  },

  // Pension §47 + §45A — NIS amounts frozen vs 2024. §45A rates: 25% life-insurance, 35% pension fund.
  pension: {
    value: {
      employee_deduction_ceiling_nis: 116_400,
      credit_base_ceiling_nis: 2_268,
      credit_rate_life_insurance: 0.25,
      credit_rate_pension_fund: 0.35,
      self_employed_ceiling_nis: 116_400,
    },
    cite: 'annual-deductions-2025',
  },

  // Keren hishtalmut — unchanged. annual-deductions-2025 lines 467, 469.
  keren_hishtalmut: {
    value: { taxable_above_nis: 188_544, self_employed_ceiling_nis: 293_397 },
    cite: 'annual-deductions-2025',
  },

  // Settlements — extracted from guide-individuals-2025 §11 table (the authoritative
  // 2025 list, NOT the 2024 Nevo regulation which was an incorrect earlier source).
  settlements_file: 'settlements/2025.ts',
  settlement_rule: { value: { max_income_ceiling_nis: 267_840 }, cite: 'madrich-2025' },

  separate_rates: {
    value: {
      interest_linked: 0.25,
      interest_nonlinked: 0.15,
      dividend_normal: 0.25,
      dividend_substantial: 0.30,
      capital_gains: 0.25,
      capital_gains_substantial: 0.30,
    },
    cite: 'madrich-2025',
  },

  // Mandatory-filing thresholds — same NIS values as 2024 (indexation freeze 2025-2027).
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
    cite: 'madrich-2025',
  },

  bituach_leumi_rates: {
    value: { tiers: [{ upTo: null, rate: 0.12, label: 'placeholder — see btl-rates-2025-feb.pdf' }] },
    cite: 'btl-rates-2025',
  },

  notes: [
    'Indexation freeze 2025-2027 (Arrangements Law, sa161224-4) → most NIS amounts unchanged vs 2024.',
    'KNOWN CHANGE vs 2024: pension §9A(b) exempt-pension rate rises 52% → 57% (annual-deductions-2025 line 459). Not modeled — affects retirees only.',
    'War-evacuation: §11 benefit extended for evacuated residents per settlements-employers-2025.pdf, on TOP of the regular list.',
    'Settlements §11 list extracted from guide-individuals-2025 — the authoritative table published by ITA for tax year 2025 (the rates/ceilings differ from 2024 in a few cases; per-settlement values are in settlements/2025.ts).',
    '§11 settlement pro-rata behaviour is anchored by kolzchut-section-11.',
    'KNOWN LIMITATION (W3): a separate new 2% surtax on capital-source income exists (per Shibolet), independent of the §121B 3% surtax modelled here. NOT modelled — investigate before computing for any user with significant interest/dividend/capital-gains income.',
  ],

  verification: {
    last_verified: '2026-06-05',
    verified_by: 'Yam (via claude — after deep-dive fix of B1/B2/B3 + W1 archive + 84/84 tests)',
    sign_off: 'verified',
    yoy_diff_reviewed: true,
  },
};
