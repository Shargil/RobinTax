import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runFromInput } from './run.ts';
import type { YearInput } from './calculate.ts';

const blankInput = (overrides: Partial<YearInput> & { tax_year: number }): YearInput => ({
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

describe('runFromInput', () => {
  it('happy path: verified year (2025) returns YearResult with trace', async () => {
    const input = blankInput({
      tax_year: 2025,
      employments: [
        { employer_id: 'A', taxable_income: 100_000, withheld_tax: 8_000, months_worked: 12, pension_employee_deposit: 0 },
      ],
    });
    const result = await runFromInput(input);
    assert.equal(result.tax_year, 2025);
    assert.equal(typeof result.refund_or_owe_nis, 'number');
    assert.ok(result.components, 'components present');
    assert.ok(result.trace, 'trace present');
    assert.equal(result.trace.income.total, 100_000);
    assert.equal(result.trace.taxable.gross, 100_000);
    assert.ok(result.trace.brackets.length > 0, 'brackets populated');
    assert.equal(result.trace.recommendation.refund_or_owe, result.refund_or_owe_nis);
  });

  it('blocked path: scaffold year (2020) throws with sign_off message', async () => {
    const input = blankInput({ tax_year: 2020 });
    await assert.rejects(runFromInput(input), (err: Error) => /sign_off|refuses to compute/i.test(err.message));
  });

  it('bad input: missing tax_year throws TypeError', async () => {
    // Cast to YearInput to satisfy the function signature; the runtime guard rejects it.
    const bad = { taxpayer: { gender: 'male' } } as unknown as YearInput;
    await assert.rejects(runFromInput(bad), (err: Error) => err instanceof TypeError && /tax_year/.test(err.message));
  });

  it('bad input: non-object throws TypeError', async () => {
    await assert.rejects(runFromInput(null as unknown as YearInput), (err: Error) => err instanceof TypeError);
  });
});
