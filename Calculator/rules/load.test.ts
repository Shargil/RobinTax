import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './load.ts';
import { makeFixtureYear } from '../__fixtures__/fixture-year.ts';

describe('validate(YearRules)', () => {
  it('accepts a well-formed fixture year', () => {
    const rules = makeFixtureYear();
    assert.doesNotThrow(() => validate(rules));
  });

  it('rejects unverified year when requireVerified=true', () => {
    const rules = makeFixtureYear({
      verification: {
        last_verified: '9999-01-01',
        verified_by: 'test',
        sign_off: 'unverified',
        yoy_diff_reviewed: false,
      },
    });
    assert.throws(() => validate(rules), /sign_off='unverified'/);
  });

  it('accepts unverified year when requireVerified=false', () => {
    const rules = makeFixtureYear({
      verification: {
        last_verified: '9999-01-01',
        verified_by: 'test',
        sign_off: 'unverified',
        yoy_diff_reviewed: false,
      },
    });
    assert.doesNotThrow(() => validate(rules, { requireVerified: false }));
  });

  it('rejects non-monotonic brackets', () => {
    const rules = makeFixtureYear();
    rules.brackets = {
      value: [
        { upTo: 100_000, rate: 0.10 },
        { upTo: 50_000, rate: 0.20 }, // non-monotonic upTo
        { upTo: null, rate: 0.30 },
      ],
      cite: 'fixture-guide',
    };
    assert.throws(() => validate(rules), /brackets\[1\]\.upTo/);
  });

  it('rejects brackets with non-increasing rates', () => {
    const rules = makeFixtureYear();
    rules.brackets = {
      value: [
        { upTo: 100_000, rate: 0.20 },
        { upTo: 200_000, rate: 0.10 }, // rate decreases
        { upTo: null, rate: 0.30 },
      ],
      cite: 'fixture-guide',
    };
    assert.throws(() => validate(rules), /rate/);
  });

  it('rejects null upTo on non-last bracket', () => {
    const rules = makeFixtureYear();
    rules.brackets = {
      value: [
        { upTo: null, rate: 0.10 },     // null not allowed except on last
        { upTo: 200_000, rate: 0.20 },
        { upTo: null, rate: 0.30 },
      ],
      cite: 'fixture-guide',
    };
    assert.throws(() => validate(rules));
  });

  it('rejects point_value_annual outside sane band', () => {
    const rules = makeFixtureYear();
    rules.point_value_annual = { value: 100, cite: 'fixture-guide' };
    assert.throws(() => validate(rules), /point_value_annual/);
  });

  it('rejects point_value_monthly inconsistent with annual/12', () => {
    const rules = makeFixtureYear();
    rules.point_value_monthly = { value: 999, cite: 'fixture-guide' };
    assert.throws(() => validate(rules), /point_value_monthly/);
  });

  it('rejects unresolved citation keys', () => {
    const rules = makeFixtureYear();
    rules.brackets = { value: rules.brackets.value, cite: 'no-such-citation' };
    assert.throws(() => validate(rules), /no-such-citation/);
  });

  it('rejects separate_rates outside [0,1]', () => {
    const rules = makeFixtureYear();
    rules.separate_rates.value.interest_linked = 1.5;
    assert.throws(() => validate(rules), /interest_linked/);
  });
});
