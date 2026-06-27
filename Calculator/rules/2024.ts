// Tax year 2024 — populated 2026-06-03 from archived ITA + BTL sources in
// ./sources/2024/. Each parameter cites the source it was read from. NOT YET
// signed off: review the values + YoY-diff vs 2023 (when populated) or 2025
// and flip `verification.sign_off` to 'verified' if they match the PDFs.
//
// See ./sources/2024/sources.md for the SHA256-stamped manifest.

import type { YearRules } from './types.ts';

export const rules: YearRules = {
  tax_year: 2024,

  citations: {
    'madrich-2024': {
      url: 'https://www.gov.il/BlobFolder/generalpage/income-tax-guide-knowyourright/he/Guides_IncomeTax_da-2024.pdf',
      source_file: 'sources/2024/guide-individuals-2024.pdf',
      fetched: '2026-06-03',
      sha256: '80dea8571f7241a89fe9d6bc59b1716302eb15dfb8c9cd7bb6505228539a93bc',
      notes: 'Primary: annual filing guide "דע זכויותיך וחובותיך 2024" — backs most credit/eligibility rules.',
    },
    'annual-deductions-2024': {
      url: 'https://www.gov.il/BlobFolder/generalpage/income-tax-annual-deductions-booklet/he/generalInformation_income-tax-yearly-deductions-booklet_yearly-deductions-booklet-2024.pdf',
      source_file: 'sources/2024/annual-deductions-2024.pdf',
      fetched: '2026-06-03',
      sha256: 'bd92a175019b0d1d35b733f0fabe316ee65e592d0e5cc6cab9eb55880428b7a4',
      notes: 'Annual deductions booklet — table of brackets, point value, all ceilings. Two-source check vs madrich-2024.',
    },
    'monthly-deductions-2024': {
      url: 'https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2024.pdf',
      source_file: 'sources/2024/monthly-deductions-2024.pdf',
      fetched: '2026-06-03',
      sha256: 'b7359a865ec08bf77a14f8b1e76d141efe9bbf2e34b4c84abb4ec67380237fe8',
    },
    'settlements-nevo-2024': {
      url: 'https://www.nevo.co.il/law_html/law00/224303.htm',
      source_file: 'sources/2024/settlements-nevo-2024.html',
      fetched: '2026-06-03',
      sha256: '3f25826495e6cb3b26279ee86762e67d268b88ef004382b6e0322497289cde5b',
      notes: 'Full §11 eligible-settlement table including מדרשת בן גוריון (7%, ceiling 146,640).',
    },
    'btl-rates-2024': {
      url: 'https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/שינוי בתשלום דמי ביטוח לאומי ודמי ביטוח בריאות לשנת 2024.pdf',
      source_file: 'sources/2024/btl-rates-2024.pdf',
      fetched: '2026-06-03',
      sha256: 'b503e436c0da31cd893bbccdecbbd759bac1d586edee365ee917d228d14594ce',
    },
    'kolzchut-section-11': {
      url: 'https://www.kolzchut.org.il/he/זיכוי_ממס_הכנסה_לתושבים_בפריפריה',
      source_file: 'sources/_shared/kolzchut-section-11-periphery.html',
      fetched: '2026-06-05',
      sha256: '11ba0b2fa7b92e764d2ed440e5356d05ed16b3168524d986242424a174673401',
      notes: '§11 settlement benefit: confirms linear pro-rata by qualifying months ("חלק היחסי של ההטבה בהתאם למשך מגוריהם ביישוב באותה שנה") + 12-month consecutive-residency floor. Anchors the engine\'s settlementDiscount() pro-rata behaviour.',
    },
  },

  // Brackets: confirmed at annual-deductions-2024 lines 354-359 + madrich-2024 (two-source).
  // Top marginal is 47%; the 3% מס יסף on income above 721,560 is in `surtax` below.
  brackets: {
    value: [
      { upTo: 84_120,  rate: 0.10 },
      { upTo: 120_720, rate: 0.14 },
      { upTo: 193_800, rate: 0.20 },
      { upTo: 269_280, rate: 0.31 },
      { upTo: 560_280, rate: 0.35 },
      { upTo: null,    rate: 0.47 },
    ],
    cite: 'annual-deductions-2024',
  },
  // מס יסף — §121B. Confirmed madrich-2024 lines 152, 224, 266, 531-533.
  surtax: { value: { threshold_nis: 721_560, rate: 0.03 }, cite: 'madrich-2024' },

  // Point value: 2,904 NIS/year (242/month). Confirmed annual-deductions-2024 line 402.
  point_value_annual:  { value: 2_904, cite: 'annual-deductions-2024' },
  point_value_monthly: { value: 242,   cite: 'annual-deductions-2024' },

  // Base residency points — §33A + §36. 2.25 for resident, +0.5 for being female.
  base_points: {
    value: { resident_male: 2.25, resident_female: 2.75 },
    cite: 'madrich-2024',
  },

  // Discharged-soldier credit — §39A. madrich-2024 lines 4298-4325 + Kolzchut
  // verification: 2 pts/year (long service: ≥23m IDF male, ≥22m IDF female, ≥24m
  // national/civilian), 1 pt/year (12m–long). Minimum 12m service; <12m medical
  // discharge counts as 12m. 36-month window starts the month AFTER discharge.
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
    cite: 'madrich-2024',
  },

  // Immigrant credit — §35. Standard 3 / 2 / 1 schedule for years 1-3 post-aliyah.
  immigrant_points: { value: { by_year_from_aliyah: [3, 2, 1] }, cite: 'madrich-2024' },

  // Canonical spec: tax-rule/degree-40c-40d.md
  // (Encodes pre-2023 single-year rule; post-2023 reform conflict surfaced in spec.)
  degree_points: {
    value: { first_degree: 1, second_degree: 0.5, third_or_medical: 1, eligible_years_post_completion: 1 },
    cite: 'madrich-2024',
  },

  // Children credit — §40(B) + 2024 reform. madrich-2024 lines 161-174 describe the
  // schedule. Schema kept as a free Record per type — populate per-case in input layer.
  children_points: {
    value: {
      schedule: {
        // Per the 2024 reform: +2 pts per parent for each child aged 1-2;
        // +1 pt per parent for each child born in the tax year or aged 3+.
        born_in_year: 1,
        age_1_to_2: 2,
        age_3_to_5: 1,
      },
      notes: 'Reform per ספר חוקים 3048; effective for 2024-2025. madrich-2024 §157+.',
    },
    cite: 'madrich-2024',
  },

  // Single-parent — §40(B). Additional 1 point.
  single_parent_points: { value: 1, cite: 'madrich-2024' },

  // Disability §9(5). Full exemption at 89%+ disability (or 100% for 365+ days).
  disability_points: {
    value: { full_exemption_min_percent: 89, partial_points: {} },
    cite: 'madrich-2024',
  },

  // Donation §46. Rate 35% (universal individuals).
  //   Min eligible per year:  207 NIS         (annual-deductions-2024 line 480)
  //   Max eligible absolute:  10,354,816 NIS  (annual-deductions-2024 line 484)
  //   Share cap of taxable income: 30% (§46(a)).
  donation: {
    value: {
      rate: 0.35,
      min_eligible_nis_per_year: 207,
      max_eligible_nis_absolute: 10_354_816,
      max_eligible_share_of_taxable_income: 0.30,
    },
    cite: 'annual-deductions-2024',
  },

  // Pension §47 (deduction) + §45A (credit). Per Kolzchut + ITA circular 19/2004:
  //   §47(a)(1)(1) work-income deduction ceiling: 116,400 (annual-deductions-2024:406)
  //   §45A(d) credit-base ceiling: 2,268 (annual-deductions-2024:412)
  //   §45A(a)(1) life-insurance premium credit rate: 25%
  //   §45A(a)(2) קופת גמל לקצבה credit rate: 35%
  pension: {
    value: {
      employee_deduction_ceiling_nis: 116_400,
      credit_base_ceiling_nis: 2_268,
      credit_rate_life_insurance: 0.25,
      credit_rate_pension_fund: 0.35,
      self_employed_ceiling_nis: 116_400,
    },
    cite: 'annual-deductions-2024',
  },

  // Keren hishtalmut. annual-deductions-2024 lines 435, 437.
  //   Salary ceiling above which employer deposits become taxable §3(e): 188,544
  //   Self-employed §3(e2) ceiling: 293,397
  keren_hishtalmut: {
    value: { taxable_above_nis: 188_544, self_employed_ceiling_nis: 293_397 },
    cite: 'annual-deductions-2024',
  },

  // Eligible settlements — separate file (./settlements/2024.ts). Extracted from
  // guide-individuals-2024 §11 table (the authoritative published list).
  settlements_file: 'settlements/2024.ts',
  // Settlement rule: per-settlement ceiling overrides this fallback. The highest tier
  // observed in the 2024 guide table is 267,840 (priority group 14).
  settlement_rule: { value: { max_income_ceiling_nis: 267_840 }, cite: 'madrich-2024' },

  // Separate-rate items §125B/C. Standard individual rates.
  //   Interest: 25% on indexed (CPI-linked), 15% on non-linked.
  //   Dividend: 25% normal, 30% for substantial shareholder (10%+ holding).
  //   Capital gains: 25% / 30% (substantial).
  separate_rates: {
    value: {
      interest_linked: 0.25,
      interest_nonlinked: 0.15,
      dividend_normal: 0.25,
      dividend_substantial: 0.30,
      capital_gains: 0.25,
      capital_gains_substantial: 0.30,
    },
    cite: 'madrich-2024',
  },

  // Mandatory-filing thresholds. Per תקנות פטור מהגשת דין וחשבון, תשמ"ח-1988
  // (Wikisource / cpa-dray deep-dive 2026-06-04). All NIS amounts frozen 2023-2026.
  // Multi-employer is captured by gross_salary_nis on AGGREGATED salary — there is
  // no separate lower "two-employers-without-תיאום-מס" sub-threshold in the regulation.
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
    cite: 'madrich-2024',
  },

  // BTL tiers — simplified: refund calc reads BTL withheld off the BTL confirmation
  // directly. Detailed re-computation isn't load-bearing for the refund. Single
  // placeholder tier; expand if BTL re-derivation is ever needed.
  bituach_leumi_rates: {
    value: { tiers: [{ upTo: null, rate: 0.12, label: 'placeholder — see btl-rates-2024.pdf' }] },
    cite: 'btl-rates-2024',
  },

  notes: [
    'Indexation freeze 2025-2027 (Arrangements Law, sa161224-4) → 2024 NIS amounts unchanged vs 2025 for most parameters.',
    'War-evacuation: §11 settlement benefit extended for evacuated residents per settlements-employers-2024.pdf, on TOP of the regular Nevo list.',
    'Pension §9A(b) exempt-pension rate is 52% for 2024 (annual-deductions-2024 line 427) — rises to 57% in 2025.',
    'BTL tiers stored as a placeholder; refund engine reads BTL withheld directly from the BTL confirmation rather than re-deriving.',
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
