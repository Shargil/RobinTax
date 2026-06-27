import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBrackets,
  applySurtax,
  calculate,
  donationCredit,
  immigrantPoints,
  mandatoryFilingTriggers,
  pensionCredit,
  separateRateTax,
  settlementDiscount,
  soldierPoints,
  type YearInput,
} from './calculate.ts';
import { makeFixtureSettlements, makeFixtureYear } from '../__fixtures__/fixture-year.ts';

const blankInput = (overrides: Partial<YearInput> = {}): YearInput => ({
  tax_year: 9999,
  taxpayer: { gender: 'male' },
  employments: [],
  btl_benefits: [],
  investment_income: {
    interest_linked: 0,
    interest_nonlinked: 0,
    dividend_normal: 0,
    dividend_substantial: 0,
    capital_gains: 0,
    capital_gains_substantial: 0,
    separate_withheld_tax: 0,
  },
  donations_nis: 0,
  pension_45a_credit_base: { life_insurance_nis: 0, pension_fund_nis: 0 },
  pension_47_deduction_base: { life_insurance_nis: 0, pension_fund_nis: 0 },
  ...overrides,
});

describe('applyBrackets', () => {
  const brackets = [
    { upTo: 100_000, rate: 0.10 },
    { upTo: 200_000, rate: 0.20 },
    { upTo: null, rate: 0.30 },
  ];
  it('zero income → zero tax', () => {
    assert.equal(applyBrackets(0, brackets), 0);
    assert.equal(applyBrackets(-10, brackets), 0);
  });
  it('first bracket only', () => {
    assert.equal(applyBrackets(50_000, brackets), 5_000);
  });
  it('exactly at the first bracket top', () => {
    assert.equal(applyBrackets(100_000, brackets), 10_000);
  });
  it('spanning two brackets', () => {
    // 100k*0.10 + 50k*0.20 = 10k + 10k = 20k
    assert.equal(applyBrackets(150_000, brackets), 20_000);
  });
  it('into top bracket', () => {
    // 100k*0.10 + 100k*0.20 + 50k*0.30 = 10k + 20k + 15k = 45k
    assert.equal(applyBrackets(250_000, brackets), 45_000);
  });
});

describe('applySurtax', () => {
  it('zero below threshold', () => {
    assert.equal(applySurtax(500_000, { threshold_nis: 700_000, rate: 0.03 }), 0);
  });
  it('3% on the excess above threshold', () => {
    assert.equal(applySurtax(800_000, { threshold_nis: 700_000, rate: 0.03 }), 3_000);
  });
});

describe('soldierPoints (§39A — annualized + eligible-months pro-rata)', () => {
  const rule = makeFixtureYear().soldier_points.value;
  const fullService = (discharge_year: number, discharge_month: number) => ({
    service_months_full: 30,
    service_months_partial: 0,
    discharge_year,
    discharge_month,
  });

  // Test names contain a `[<id>]` tag matching the canonical worked-examples table in
  // tax-rule/soldier-39a.md. Drift test asserts every spec id has a matching test.

  it('[outside-window]', () => {
    assert.equal(soldierPoints(2024, 'male', fullService(2020, 1), rule), 0);
  });

  it('[floor]', () => {
    const pts = soldierPoints(2025, 'male', {
      service_months_full: 10, service_months_partial: 0, discharge_year: 2024, discharge_month: 12,
    }, rule);
    assert.equal(pts, 0);
  });

  it('[kolzchut-b1]', () => {
    const pts = soldierPoints(2025, 'male', {
      service_months_full: 30, service_months_partial: 0, discharge_year: 2022, discharge_month: 7,
    }, rule);
    assert.ok(Math.abs(pts - 7 / 6) < 1e-9, `expected 7/6, got ${pts}`);
  });

  it('[madrich-b1]', () => {
    const pts = soldierPoints(2024, 'male', {
      service_months_full: 30, service_months_partial: 0, discharge_year: 2021, discharge_month: 8,
    }, rule);
    assert.ok(Math.abs(pts - 8 / 6) < 1e-9, `expected 8/6, got ${pts}`);
  });

  it('[full-year]', () => {
    const pts = soldierPoints(2025, 'male', {
      service_months_full: 24, service_months_partial: 0, discharge_year: 2024, discharge_month: 12,
    }, rule);
    assert.equal(pts, 2);
  });

  it('[short-15m]', () => {
    const pts = soldierPoints(2025, 'male', {
      service_months_full: 15, service_months_partial: 0, discharge_year: 2024, discharge_month: 12,
    }, rule);
    assert.equal(pts, 1);
  });

  it('[idf-female-22m-boundary]', () => {
    const pts = soldierPoints(2025, 'female', {
      service_months_full: 22, service_months_partial: 0, discharge_year: 2024, discharge_month: 12,
    }, rule);
    assert.equal(pts, 2);
  });

  it('[idf-female-21m-short]', () => {
    const pts = soldierPoints(2025, 'female', {
      service_months_full: 21, service_months_partial: 0, discharge_year: 2024, discharge_month: 12,
    }, rule);
    assert.equal(pts, 1);
  });

  it('[medical-early-discharge]', () => {
    const pts = soldierPoints(2025, 'male', {
      service_months_full: 8, service_months_partial: 0, discharge_year: 2024, discharge_month: 12,
      early_discharge_medical: true,
    }, rule);
    assert.equal(pts, 1);
  });

  it('[national-23m-short]', () => {
    const pts = soldierPoints(2025, 'male', {
      service_months_full: 23, service_months_partial: 0, discharge_year: 2024, discharge_month: 12,
      service_track: 'national',
    }, rule);
    assert.equal(pts, 1);
  });

  it('[national-24m-long]', () => {
    const pts = soldierPoints(2025, 'female', {
      service_months_full: 24, service_months_partial: 0, discharge_year: 2024, discharge_month: 12,
      service_track: 'national',
    }, rule);
    assert.equal(pts, 2);
  });
});

describe('immigrantPoints', () => {
  const schedule = { by_year_from_aliyah: [3, 2, 1] };
  it('returns the right entry by years-since-aliyah', () => {
    assert.equal(immigrantPoints(2024, 2024, schedule), 3);
    assert.equal(immigrantPoints(2025, 2024, schedule), 2);
    assert.equal(immigrantPoints(2027, 2024, schedule), 0); // past schedule
    assert.equal(immigrantPoints(2023, 2024, schedule), 0); // before aliyah
  });
});

describe('calculate — degree points (§40C/§40D, current pre-2023 simplification)', () => {
  // Canonical spec: tax-rule/degree-40c-40d.md → ## Worked examples.
  // Tests cover ONLY the shipped pre-2023 single-year flat-first_degree behavior.
  // Target post-2023 reform behavior is documented in spec but not yet implemented.
  const rules = makeFixtureYear();
  const settlements = makeFixtureSettlements();

  it('[degree-none] no degree on taxpayer → 0 degree credit points', () => {
    const r = calculate(blankInput({ employments: [{ employer_id: 'A', taxable_income: 100_000, withheld_tax: 0, months_worked: 12, pension_employee_deposit: 0 }] }), rules, settlements);
    assert.equal(r.trace.credit_points.degree, 0);
  });

  it('[degree-present-current-flat-first-degree] any degree set → flat rules.first_degree, ignoring kind/year', () => {
    const r = calculate(
      blankInput({
        taxpayer: { gender: 'male', degree: { kind: 'second', completed_year: 2024 } },
        employments: [{ employer_id: 'A', taxable_income: 100_000, withheld_tax: 0, months_worked: 12, pension_employee_deposit: 0 }],
      }),
      rules,
      settlements,
    );
    assert.equal(r.trace.credit_points.degree, rules.degree_points.value.first_degree);
  });
});

describe('settlementDiscount', () => {
  const rule = makeFixtureYear().settlement_rule.value;
  const settlements = makeFixtureSettlements();
  it('[settlement-not-listed] zero for non-listed settlement', () => {
    const r = settlementDiscount({ settlement_he: 'NotListed', qualifying_months: 12 }, settlements, rule, 150_000);
    assert.equal(r.discount_nis, 0);
  });
  it('[settlement-full-year-cap-below-income] full year @ 10% on income up to ceiling', () => {
    // 150k < 250k ceiling → eligible 150k * 0.10 * 12/12 = 15k
    const r = settlementDiscount({ settlement_he: 'TestVillage', qualifying_months: 12 }, settlements, rule, 150_000);
    assert.equal(r.discount_nis, 15_000);
  });
  it('[settlement-income-above-ceiling] income capped at ceiling', () => {
    // 1M income, ceiling 250k → eligible base = 250k → 25k discount
    const r = settlementDiscount({ settlement_he: 'TestVillage', qualifying_months: 12 }, settlements, rule, 1_000_000);
    assert.equal(r.discount_nis, 25_000);
  });
  it('[settlement-pro-rata-6-months] pro-rates by qualifying months', () => {
    // 150k, 6 months → 150k * 0.10 * 0.5 = 7500
    const r = settlementDiscount({ settlement_he: 'TestVillage', qualifying_months: 6 }, settlements, rule, 150_000);
    assert.equal(r.discount_nis, 7_500);
  });
});

describe('donationCredit', () => {
  const rule = makeFixtureYear().donation.value;
  it('[below-min] zero below minimum eligible', () => {
    assert.equal(donationCredit(150, 100_000, rule), 0);
  });
  it('[at-min-boundary] credits full amount once the floor is exactly met', () => {
    // 200 == fixture floor → not below → 200 * 0.35 = 70
    assert.equal(donationCredit(200, 100_000, rule), 70);
  });
  it('[share-cap] 35% of donation, capped at 30% of taxable income', () => {
    // 50k donation, taxable 100k → share-cap = 30k → 30k * 0.35 = 10500
    assert.equal(donationCredit(50_000, 100_000, rule), 10_500);
  });
  it('[under-cap] 35% of donation when under cap', () => {
    assert.equal(donationCredit(1_000, 100_000, rule), 350);
  });
});

describe('separateRateTax', () => {
  it('sums each component at its own rate', () => {
    const rates = makeFixtureYear().separate_rates.value;
    const tax = separateRateTax(
      {
        interest_linked: 1_000,
        interest_nonlinked: 1_000,
        dividend_normal: 1_000,
        dividend_substantial: 1_000,
        capital_gains: 1_000,
        capital_gains_substantial: 1_000,
        separate_withheld_tax: 0,
      },
      rates,
    );
    // 0.25 + 0.15 + 0.25 + 0.30 + 0.25 + 0.30 = 1.50 of 1000 = 1500
    assert.equal(tax, 1_500);
  });

  // §102 secondary (capital-gains track) — canonical spec tax-rule/secondary-102.md
  it('§102 secondary capital-gains track taxes a 200k gain at 25% [secondary-25pct-capital-track]', () => {
    const rates = makeFixtureYear().separate_rates.value;
    const tax = separateRateTax(
      {
        interest_linked: 0,
        interest_nonlinked: 0,
        dividend_normal: 0,
        dividend_substantial: 0,
        capital_gains: 200_000,
        capital_gains_substantial: 0,
        separate_withheld_tax: 0,
      },
      rates,
    );
    assert.equal(tax, 50_000);
  });

  it('§102 secondary by a substantial shareholder (≥10%) taxes a 200k gain at 30% [secondary-30pct-substantial]', () => {
    const rates = makeFixtureYear().separate_rates.value;
    const tax = separateRateTax(
      {
        interest_linked: 0,
        interest_nonlinked: 0,
        dividend_normal: 0,
        dividend_substantial: 0,
        capital_gains: 0,
        capital_gains_substantial: 200_000,
        separate_withheld_tax: 0,
      },
      rates,
    );
    assert.equal(tax, 60_000);
  });

  // Capital-market interest/dividend buckets — canonical spec tax-rule/capital-gains-91-92.md
  const oneBucket = (field: keyof YearInput['investment_income'], amount: number) => {
    const income: YearInput['investment_income'] = {
      interest_linked: 0,
      interest_nonlinked: 0,
      dividend_normal: 0,
      dividend_substantial: 0,
      capital_gains: 0,
      capital_gains_substantial: 0,
      separate_withheld_tax: 0,
    };
    income[field] = amount;
    return separateRateTax(income, makeFixtureYear().separate_rates.value);
  };

  it('CPI-linked interest taxed at 25% [capmkt-interest-linked-25pct]', () =>
    assert.equal(oneBucket('interest_linked', 10_000), 2_500));
  it('nominal (non-linked) interest taxed at 15% [capmkt-interest-nonlinked-15pct]', () =>
    assert.equal(oneBucket('interest_nonlinked', 10_000), 1_500));
  it('ordinary dividend taxed at 25% [capmkt-dividend-normal-25pct]', () =>
    assert.equal(oneBucket('dividend_normal', 10_000), 2_500));
  it('substantial-shareholder dividend taxed at 30% [capmkt-dividend-substantial-30pct]', () =>
    assert.equal(oneBucket('dividend_substantial', 10_000), 3_000));
});

describe('calculate — capital-markets §91/§92 over-withholding refund (tax-rule/capital-gains-91-92.md)', () => {
  const rules = makeFixtureYear();
  const settlements = makeFixtureSettlements();
  // No salary; ₪40k ordinary dividend; bank withheld ₪12k (30%); correct rate 25% → ₪10k owed.
  const input = blankInput({
    investment_income: {
      interest_linked: 0,
      interest_nonlinked: 0,
      dividend_normal: 40_000,
      dividend_substantial: 0,
      capital_gains: 0,
      capital_gains_substantial: 0,
      separate_withheld_tax: 12_000,
    },
  });
  const r = calculate(input, rules, settlements);

  it('separate_tax = 40k × 25% = 10k [capmkt-overwithheld-refund]', () =>
    assert.equal(r.components.separate_tax, 10_000));
  it('refund = 12000 withheld − 10000 owed = 2000', () =>
    assert.equal(r.refund_or_owe_nis, 2_000));
  it('recommendation = file', () => assert.equal(r.recommendation, 'file'));
});

describe('calculate — secondary §102 over-withholding refund (tax-rule/secondary-102.md)', () => {
  const rules = makeFixtureYear();
  const settlements = makeFixtureSettlements();
  // No salary; ₪100k capital-track gain; trustee withheld ₪30k (30%); correct rate 25% → ₪25k owed.
  const input = blankInput({
    investment_income: {
      interest_linked: 0,
      interest_nonlinked: 0,
      dividend_normal: 0,
      dividend_substantial: 0,
      capital_gains: 100_000,
      capital_gains_substantial: 0,
      separate_withheld_tax: 30_000,
    },
  });
  const r = calculate(input, rules, settlements);

  it('separate_tax = 100k × 25% = 25k [secondary-overwithheld-refund]', () =>
    assert.equal(r.components.separate_tax, 25_000));
  it('refund = 30000 withheld − 25000 owed = 5000', () =>
    assert.equal(r.refund_or_owe_nis, 5_000));
  it('recommendation = file', () => assert.equal(r.recommendation, 'file'));
});

describe('calculate — golden case (single employer, no extras)', () => {
  const rules = makeFixtureYear();
  const settlements = makeFixtureSettlements();
  const input = blankInput({
    employments: [
      {
        employer_id: 'A',
        taxable_income: 150_000,
        withheld_tax: 30_000,
        months_worked: 12,
        pension_employee_deposit: 5_000,
      },
    ],
  });
  const r = calculate(input, rules, settlements);

  it('taxable_ordinary = 150k', () => assert.equal(r.components.taxable_ordinary, 150_000));
  it('gross_tax = 20k via 100k@10% + 50k@20%', () => assert.equal(r.components.gross_tax, 20_000));
  it('credit_amount = 2.25 × 3000 = 6750 (resident male, no other status)', () =>
    assert.equal(r.components.credit_amount, 6_750));
  it('ordinary_tax = 20000 − 6750 = 13250', () => assert.equal(r.components.ordinary_tax, 13_250));
  it('refund = 30000 − 13250 = 16750', () => assert.equal(r.refund_or_owe_nis, 16_750));
  it('recommendation = file', () => assert.equal(r.recommendation, 'file'));
  it('no mandatory triggers (income < 700k, single employer)', () =>
    assert.deepEqual(r.mandatory_triggers, []));

  // trace assertions — golden case exposes the walkthrough math
  it('trace.income echoes per-source rows + total', () => {
    assert.deepEqual(r.trace.income.sources, [
      { label: 'employer A', amount: 150_000, kind: 'employment' },
    ]);
    assert.equal(r.trace.income.total, 150_000);
  });
  it('trace.taxable shows gross − §47 deduction', () => {
    assert.equal(r.trace.taxable.gross, 150_000);
    assert.equal(r.trace.taxable.pension_section_47_deduction, 0);
    assert.equal(r.trace.taxable.taxable, 150_000);
  });
  it('trace.brackets sums to gross_tax and shows per-bracket detail', () => {
    const sumTax = r.trace.brackets.reduce((s, b) => s + b.taxAdded, 0);
    assert.equal(sumTax, r.components.gross_tax);
    const sumWidth = r.trace.brackets.reduce((s, b) => s + b.widthApplied, 0);
    assert.equal(sumWidth, r.components.taxable_ordinary);
    // 100k @ 10% in first bracket, 50k @ 20% in second, 0 in top
    assert.equal(r.trace.brackets[0].widthApplied, 100_000);
    assert.equal(r.trace.brackets[0].taxAdded, 10_000);
    assert.equal(r.trace.brackets[1].widthApplied, 50_000);
    assert.equal(r.trace.brackets[1].taxAdded, 10_000);
    assert.equal(r.trace.brackets[2].widthApplied, 0);
  });
  it('trace.credit_points breaks down by status', () => {
    assert.equal(r.trace.credit_points.base, 2.25);
    assert.equal(r.trace.credit_points.soldier, 0);
    assert.equal(r.trace.credit_points.total, 2.25);
    assert.equal(r.trace.credit_points.credit_amount, 6_750);
  });
  it('trace.recommendation mirrors top-level refund_or_owe', () => {
    assert.equal(r.trace.recommendation.refund_or_owe, r.refund_or_owe_nis);
    assert.equal(r.trace.recommendation.withheld, 30_000);
  });
  it('trace.settlement is null when no residency input', () => {
    assert.equal(r.trace.settlement, null);
  });
  it('trace.donation is null when no donation', () => {
    assert.equal(r.trace.donation, null);
  });
});

describe('calculate — golden case (multi-employer + settlement, Yam-like) [multi-employer-aggregate]', () => {
  const rules = makeFixtureYear();
  const settlements = makeFixtureSettlements();
  const input = blankInput({
    taxpayer: {
      gender: 'male',
      discharged_soldier: { service_months_full: 36, service_months_partial: 0, discharge_year: 9998, discharge_month: 12 },
      residency: { settlement_he: 'TestVillage', qualifying_months: 12 },
    },
    employments: [
      { employer_id: 'A', taxable_income: 60_000, withheld_tax: 12_000, months_worked: 6, pension_employee_deposit: 0 },
      { employer_id: 'B', taxable_income: 40_000, withheld_tax: 12_000, months_worked: 4, pension_employee_deposit: 0 },
    ],
  });
  const r = calculate(input, rules, settlements);

  // taxable_ordinary = 100k
  // gross_tax = 100k * 0.10 = 10k
  // points = 2.25 (base) + 2 (soldier full year — 36m service Dec 9998 → tax_year 9999 full year) = 4.25
  // credit_amount = 4.25 * 3000 = 12750
  // settlement_discount = min(100k, 250k) * 0.10 * 12/12 = 10000
  // ordinary_tax = max(0, 10000 - 12750 - 10000) = 0  (over-credited)
  // refund = withheld(24000) - 0 = 24000
  it('taxable_ordinary = 100k', () => assert.equal(r.components.taxable_ordinary, 100_000));
  it('soldier (full year) → credit_points_total = 4.25', () => assert.equal(r.components.credit_points_total, 4.25));
  it('settlement discount = 10k', () => assert.equal(r.components.settlement_discount, 10_000));
  it('ordinary_tax clamped at 0', () => assert.equal(r.components.ordinary_tax, 0));
  it('refund = full withheld = 24k', () => assert.equal(r.refund_or_owe_nis, 24_000));
  it('recommendation = file', () => assert.equal(r.recommendation, 'file'));
});

describe('calculate — partial-year single employer (no replacement income) [partial-year-single-employer]', () => {
  // Canonical spec: tax-rule/multi-employer-121-164.md § Worked examples row `partial-year-single-employer`.
  // Demonstrates: engine applies §121 brackets to actual annual income (NOT annualized),
  // and applies full annual credit points (NOT pro-rated by months_worked).
  const rules = makeFixtureYear();
  const settlements = makeFixtureSettlements();
  const input = blankInput({
    employments: [
      { employer_id: 'A', taxable_income: 50_000, withheld_tax: 8_000, months_worked: 6, pension_employee_deposit: 0 },
    ],
  });
  const r = calculate(input, rules, settlements);

  // taxable_ordinary = 50k
  // gross_tax = 50k * 0.10 = 5_000
  // points = 2.25 (base, male) → credit_amount = 2.25 * 3000 = 6_750
  // ordinary_tax = max(0, 5000 - 6750) = 0  (annual credit > tax on actual annual income)
  // refund = withheld(8000) - 0 = 8000
  it('taxable_ordinary = 50k (actual, NOT annualized)', () => assert.equal(r.components.taxable_ordinary, 50_000));
  it('credit_points_total = 2.25 (full annual entitlement, NOT pro-rated by months_worked=6)', () =>
    assert.equal(r.components.credit_points_total, 2.25));
  it('ordinary_tax clamped at 0', () => assert.equal(r.components.ordinary_tax, 0));
  it('refund = full withheld = 8k', () => assert.equal(r.refund_or_owe_nis, 8_000));
  it('recommendation = file', () => assert.equal(r.recommendation, 'file'));
});

describe('calculate — properties', () => {
  const rules = makeFixtureYear();
  const settlements = makeFixtureSettlements();
  const baseInput = blankInput({
    employments: [
      { employer_id: 'A', taxable_income: 150_000, withheld_tax: 10_000, months_worked: 12, pension_employee_deposit: 0 },
    ],
  });

  it('refund ≤ total_withheld', () => {
    const r = calculate(baseInput, rules, settlements);
    assert.ok(r.refund_or_owe_nis <= r.components.total_withheld);
  });

  it('more income (holding withheld+else equal) never increases refund', () => {
    const less = calculate(baseInput, rules, settlements).refund_or_owe_nis;
    const moreInput = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 250_000, withheld_tax: 10_000, months_worked: 12, pension_employee_deposit: 0 },
      ],
    });
    const more = calculate(moreInput, rules, settlements).refund_or_owe_nis;
    assert.ok(more <= less, `more income should not increase refund: ${more} > ${less}`);
  });

  it('mandatory-file recommendation when income > threshold AND owe', () => {
    // Income > 700k fixture gross_salary_nis = 700_000; tiny withholding → owe.
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 800_000, withheld_tax: 1_000, months_worked: 12, pension_employee_deposit: 0 },
      ],
    });
    const r = calculate(input, rules, settlements);
    assert.ok(r.refund_or_owe_nis < 0, 'should owe');
    assert.equal(r.recommendation, 'mandatory-file');
    assert.ok(r.mandatory_triggers.length > 0);
  });

  it('do-not-file when owe and not mandatory', () => {
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 200_000, withheld_tax: 1_000, months_worked: 12, pension_employee_deposit: 0 },
      ],
    });
    const r = calculate(input, rules, settlements);
    assert.ok(r.refund_or_owe_nis < 0);
    assert.equal(r.recommendation, 'do-not-file');
  });
});

describe('mandatoryFilingTriggers (B2 — multi-threshold from תקנות פטור)', () => {
  it('aggregated multi-employer gross salary > gross_salary_nis fires the salary trigger [multi-employer-mandatory-trigger]', () => {
    // Fixture gross_salary_nis = 700_000. Two employers @ 400k each = 800k total.
    const rules = makeFixtureYear();
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 400_000, withheld_tax: 0, months_worked: 12, pension_employee_deposit: 0 },
        { employer_id: 'B', taxable_income: 400_000, withheld_tax: 0, months_worked: 12, pension_employee_deposit: 0 },
      ],
    });
    const triggers = mandatoryFilingTriggers(input, rules);
    assert.ok(triggers.some((t) => t.includes('gross salary')), `expected gross-salary trigger; got ${JSON.stringify(triggers)}`);
  });

  it('rental income via filing_inputs fires the rental trigger', () => {
    const rules = makeFixtureYear();
    const input = blankInput({ filing_inputs: { rental_income_nis: 400_000 } });
    const triggers = mandatoryFilingTriggers(input, rules);
    assert.ok(triggers.some((t) => t.includes('rental')));
  });

  it('foreign income via filing_inputs fires the foreign-income trigger', () => {
    const rules = makeFixtureYear();
    const input = blankInput({ filing_inputs: { foreign_income_nis: 500_000 } });
    const triggers = mandatoryFilingTriggers(input, rules);
    assert.ok(triggers.some((t) => t.includes('foreign-source income')));
  });

  it('interest income above tier fires interest trigger', () => {
    const rules = makeFixtureYear();
    const input = blankInput();
    input.investment_income.interest_linked = 600_000; // > fixture interest_income_nis 500_000
    const triggers = mandatoryFilingTriggers(input, rules);
    assert.ok(triggers.some((t) => t.includes('interest income')));
  });

  it('no triggers for a quiet salaried case under all thresholds', () => {
    const rules = makeFixtureYear();
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 150_000, withheld_tax: 0, months_worked: 12, pension_employee_deposit: 0 },
      ],
    });
    assert.deepEqual(mandatoryFilingTriggers(input, rules), []);
  });
});

describe('pensionCredit (B3 — split §45A rate)', () => {
  const rule = makeFixtureYear().pension.value;

  it('life-insurance only: 25% of deposit, capped at credit_base_ceiling', () => {
    // fixture credit_base_ceiling_nis = 10_000. Deposit 5k → 5000 × 0.25 = 1250.
    assert.equal(pensionCredit({ life_insurance_nis: 5_000, pension_fund_nis: 0 }, rule), 1_250);
  });

  it('pension-fund only: 35% of deposit, capped at credit_base_ceiling', () => {
    // Deposit 5k pension fund → 5000 × 0.35 = 1750.
    assert.equal(pensionCredit({ life_insurance_nis: 0, pension_fund_nis: 5_000 }, rule), 1_750);
  });

  it('mixed: life-insurance applied first against shared cap, pension fund gets remainder', () => {
    // 8k life + 5k pension. Cap 10k. Life eats 8k → 8000 × 0.25 = 2000.
    // Remaining cap = 2k. Pension limited to 2000 × 0.35 = 700. Total = 2700.
    assert.equal(pensionCredit({ life_insurance_nis: 8_000, pension_fund_nis: 5_000 }, rule), 2_700);
  });

  it('life-insurance exhausts cap, pension fund earns nothing extra', () => {
    // 12k life > 10k cap → 10k × 0.25 = 2500. Pension fund: remaining 0.
    assert.equal(pensionCredit({ life_insurance_nis: 12_000, pension_fund_nis: 5_000 }, rule), 2_500);
  });

  it('zero deposit → zero credit', () => {
    assert.equal(pensionCredit({ life_insurance_nis: 0, pension_fund_nis: 0 }, rule), 0);
  });
});

describe('calculate — §45A vs §47 split (no double-counting)', () => {
  const rules = makeFixtureYear();
  const settlements = makeFixtureSettlements();

  it('salaried payroll deposit (106 field 086/045) earns §45A credit but NO §47 deduction', () => {
    // Payroll deposits go in pension_45a_credit_base — §47 pool stays empty.
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 100_000, withheld_tax: 8_000, months_worked: 12, pension_employee_deposit: 5_000 },
      ],
      pension_45a_credit_base: { life_insurance_nis: 0, pension_fund_nis: 5_000 },
    });
    const r = calculate(input, rules, settlements);
    assert.equal(r.trace.taxable.gross, 100_000);
    assert.equal(r.trace.taxable.pension_section_47_deduction, 0, 'NO §47 deduction for payroll deposit');
    assert.equal(r.trace.taxable.taxable, 100_000, 'taxable === gross');
    assert.equal(r.components.pension_credit, 1_750, '§45A credit = 5,000 × 35% = 1,750');
  });

  it('voluntary §47 deposit earns BOTH the deduction AND the §45A credit on the same shekel', () => {
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 100_000, withheld_tax: 8_000, months_worked: 12, pension_employee_deposit: 0 },
      ],
      pension_47_deduction_base: { life_insurance_nis: 0, pension_fund_nis: 5_000 },
    });
    const r = calculate(input, rules, settlements);
    assert.equal(r.trace.taxable.gross, 100_000);
    assert.equal(r.trace.taxable.pension_section_47_deduction, 5_000, '§47 deduction = 5,000');
    assert.equal(r.trace.taxable.taxable, 95_000, 'taxable = 100k − 5k');
    assert.equal(r.components.pension_credit, 1_750, '§45A credit = 5,000 × 35% = 1,750');
  });

  it('mixed pools: payroll + voluntary share the §45A ceiling', () => {
    // Payroll 6k + voluntary 6k = 12k total. Fixture credit_base_ceiling = 10k.
    // Life-insurance-first cap: 0 life → pension fund = min(12k, 10k) = 10k × 35% = 3,500.
    // §47 deduction only sees the voluntary 6k.
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 100_000, withheld_tax: 8_000, months_worked: 12, pension_employee_deposit: 6_000 },
      ],
      pension_45a_credit_base: { life_insurance_nis: 0, pension_fund_nis: 6_000 },
      pension_47_deduction_base: { life_insurance_nis: 0, pension_fund_nis: 6_000 },
    });
    const r = calculate(input, rules, settlements);
    assert.equal(r.trace.taxable.pension_section_47_deduction, 6_000, 'only voluntary in §47 pool');
    assert.equal(r.trace.taxable.taxable, 94_000);
    assert.equal(r.components.pension_credit, 3_500, '§45A credit = min(12k, 10k cap) × 35%');
  });

  it('both pools empty → no deduction, no credit', () => {
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 100_000, withheld_tax: 8_000, months_worked: 12, pension_employee_deposit: 0 },
      ],
    });
    const r = calculate(input, rules, settlements);
    assert.equal(r.trace.taxable.pension_section_47_deduction, 0);
    assert.equal(r.components.pension_credit, 0);
  });
});

describe('calculate — Bituach Leumi benefits (§2(2) taxable / §9 exempt) — canonical spec tax-rule/bituach-leumi-benefits-9.md', () => {
  const rules = makeFixtureYear();
  const settlements = makeFixtureSettlements();

  it('[btl-taxable-flows-to-gross] taxable Bituach Leumi benefit added to grossOrdinary', () => {
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 60_000, withheld_tax: 0, months_worked: 6, pension_employee_deposit: 0 },
      ],
      btl_benefits: [
        { source: 'maternity (דמי לידה)', taxable_amount: 40_000, withheld_tax: 8_000 },
      ],
    });
    const r = calculate(input, rules, settlements);
    assert.equal(r.trace.taxable.gross, 100_000, 'salary 60k + taxable Bituach Leumi 40k = 100k gross');
    assert.equal(r.trace.taxable.taxable, 100_000, 'no §47 deduction → taxable === gross');
    assert.equal(r.trace.income.sources.length, 2, 'two income sources in trace (employer + Bituach Leumi)');
  });

  it('[btl-withheld-flows-to-refund] withheld tax on taxable Bituach Leumi benefit included in total_withheld', () => {
    // Only Bituach Leumi income: 40k taxable, 8k withheld. Credit points (2.25 × 3000 = 6,750) zero out
    // the tax on 40k (which is 4k @ 10%). Refund = 8k withheld − 0 liability = 8k.
    const input = blankInput({
      btl_benefits: [
        { source: 'maternity (דמי לידה)', taxable_amount: 40_000, withheld_tax: 8_000 },
      ],
    });
    const r = calculate(input, rules, settlements);
    assert.equal(r.components.total_withheld, 8_000);
    assert.equal(r.components.ordinary_tax, 0, 'credit points zero out the small bracket tax');
    assert.equal(r.refund_or_owe_nis, 8_000);
    assert.equal(r.recommendation, 'file');
  });

  it('[btl-mandatory-trigger-aggregates] taxable Bituach Leumi counted in all-source mandatory-filing trigger', () => {
    // Fixture all_source_taxable_nis = 700_000. Salary 600k + Bituach Leumi 200k = 800k.
    const input = blankInput({
      employments: [
        { employer_id: 'A', taxable_income: 600_000, withheld_tax: 0, months_worked: 12, pension_employee_deposit: 0 },
      ],
      btl_benefits: [
        { source: 'maternity (דמי לידה)', taxable_amount: 200_000, withheld_tax: 0 },
      ],
    });
    const triggers = mandatoryFilingTriggers(input, rules);
    assert.ok(
      triggers.some((t) => t.includes('all-source taxable')),
      `expected all-source-taxable trigger; got ${JSON.stringify(triggers)}`,
    );
  });

  it('[btl-exempt-not-passed-to-engine] exempt Bituach Leumi benefit (e.g. קצבת ילדים) is NOT placed in btl_benefits — engine matches baseline', () => {
    // Classifier check: if intake correctly drops exempt benefits, the engine input has empty
    // btl_benefits[] and the result equals the no-Bituach-Leumi baseline. Defensive — guards against
    // a future regression where exempt benefits leak into the input.
    const baseline = calculate(
      blankInput({
        employments: [
          { employer_id: 'A', taxable_income: 100_000, withheld_tax: 8_000, months_worked: 12, pension_employee_deposit: 0 },
        ],
      }),
      rules,
      settlements,
    );
    const withCorrectlyExcludedExemptBenefit = calculate(
      blankInput({
        employments: [
          { employer_id: 'A', taxable_income: 100_000, withheld_tax: 8_000, months_worked: 12, pension_employee_deposit: 0 },
        ],
        // קצבת ילדים, גמלת סיעוד, etc. — exempt, never reach the engine.
        btl_benefits: [],
      }),
      rules,
      settlements,
    );
    assert.equal(withCorrectlyExcludedExemptBenefit.refund_or_owe_nis, baseline.refund_or_owe_nis);
    assert.equal(withCorrectlyExcludedExemptBenefit.components.total_withheld, baseline.components.total_withheld);
  });
});
