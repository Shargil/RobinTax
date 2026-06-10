import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compare, parseValue } from './compare.ts';
import { buildPrompt, verifyClaim, type Claim } from './verify.ts';
import { render, type BottomLine } from './render.ts';

describe('parseValue', () => {
  it('extracts a currency number from a noisy answer with commas + symbol', () => {
    assert.equal(parseValue('currency', 'The answer is 41,250 ₪'), 41250);
  });
  it('parses integer only when integral', () => {
    assert.equal(parseValue('integer', '12'), 12);
    assert.equal(parseValue('integer', '12.5'), null);
  });
  it('parses credit_points in 0.25 steps', () => {
    assert.equal(parseValue('credit_points', '2.75'), 2.75);
    assert.equal(parseValue('credit_points', '2.6'), null);
  });
  it('normalizes enum to lowercase trimmed', () => {
    assert.equal(parseValue('enum', '  YES  '), 'yes');
  });
  it('returns null on UNKNOWN', () => {
    assert.equal(parseValue('currency', 'UNKNOWN'), null);
    assert.equal(parseValue('enum', 'unknown'), null);
  });
});

describe('compare', () => {
  it('agrees on exact currency', () => {
    assert.deepEqual(compare('currency', 100, 100), { verdict: 'agree', delta: 0 });
  });
  it('agrees on currency within ±1 ₪ absolute tolerance', () => {
    assert.equal(compare('currency', 41250, 41249.6).verdict, 'agree');
  });
  it('agrees on currency within ±0.5% relative for large amounts', () => {
    // 100000 ±500 → 100200 still agrees on relative even though absolute fails
    assert.equal(compare('currency', 100000, 100200).verdict, 'agree');
  });
  it('disagrees when both tolerances fail', () => {
    // 1000 vs 1100 → |Δ|=100 > 1 absolute AND > 5 (0.5% of 1000)
    assert.equal(compare('currency', 1000, 1100).verdict, 'disagree');
  });
  it('integer requires exact match', () => {
    assert.equal(compare('integer', 12, 13).verdict, 'disagree');
    assert.equal(compare('integer', 12, 12).verdict, 'agree');
  });
  it('credit_points requires exact match', () => {
    assert.equal(compare('credit_points', 2.75, 2.5).verdict, 'disagree');
    assert.equal(compare('credit_points', 2.75, 2.75).verdict, 'agree');
  });
  it('enum normalizes case + whitespace', () => {
    assert.equal(compare('enum', 'YES', '  yes  ').verdict, 'agree');
    assert.equal(compare('enum', 'yes', 'no').verdict, 'disagree');
  });
  it('null independent → uncertain', () => {
    assert.equal(compare('currency', 100, null).verdict, 'uncertain');
  });
});

describe('buildPrompt — blindness', () => {
  it('never includes the original.value in the prompt', () => {
    const claim: Claim = {
      id: 'b1',
      question: 'What is the withheld tax?',
      evidence: 'Field 042: 41,250',
      type: 'currency',
      original: { value: 41250, source: 'form-106:042' },
    };
    const p = buildPrompt(claim);
    // Evidence legitimately contains the number; the test is that the prompt
    // doesn't introduce the original.value as an *anchor* (no "the original answer is X").
    assert.ok(!p.includes('original'));
    assert.ok(!p.includes(claim.original.source));
  });
});

describe('verifyClaim — independent model cross-check (with stub runner)', () => {
  const claim: Claim = {
    id: 'test-1',
    question: 'What is the total tax withheld?',
    evidence: 'Field 042 (ניכוי מס): 41,250',
    type: 'currency',
    original: { value: 41250, source: 'form-106:042' },
  };

  it('agree when independent matches', async () => {
    const stub = async () => '41250';
    const res = await verifyClaim(claim, stub, 'stub-model');
    assert.equal(res.verdict, 'agree');
    assert.equal(res.independent, 41250);
    assert.equal(res.model, 'stub-model');
  });

  it('disagree when independent diverges past tolerance', async () => {
    const stub = async () => '50000';
    const res = await verifyClaim(claim, stub, 'stub-model');
    assert.equal(res.verdict, 'disagree');
    assert.equal(res.independent, 50000);
    assert.equal(res.delta, 8750);
  });

  it('uncertain when verifier replies UNKNOWN', async () => {
    const stub = async () => 'UNKNOWN';
    const res = await verifyClaim(claim, stub, 'stub-model');
    assert.equal(res.verdict, 'uncertain');
    assert.equal(res.independent, null);
  });

  it('passes the chosen model to the runner', async () => {
    let seenModel = '';
    const stub = async (m: string) => {
      seenModel = m;
      return '41250';
    };
    await verifyClaim(claim, stub, 'haiku');
    assert.equal(seenModel, 'haiku');
  });
});

describe('render — Mode B bottom-line', () => {
  it('renders a refund + file recommendation with provenance', () => {
    const bl: BottomLine = {
      year: 2024,
      refundOrOwe: 'refund',
      amountNis: 8420,
      recommendation: 'file',
      inputs: [
        { label: 'Salary income (Emp A)', value: 220000, source: 'form-106:2024:_1' },
        { label: 'Tax withheld (Emp A)', value: 41250, source: 'form-106:2024:_1' },
      ],
    };
    const out = render(bl);
    assert.match(out, /Year 2024/);
    assert.match(out, /REFUND/);
    assert.match(out, /FILE — claim the refund/);
    assert.match(out, /Salary income \(Emp A\)/);
    assert.match(out, /form-106:2024:_1/);
    assert.match(out, /Confirm these numbers\? \(y\/n\)/);
  });

  it('renders DO NOT FILE when owing', () => {
    const out = render({
      year: 2023,
      refundOrOwe: 'owe',
      amountNis: 3200,
      recommendation: 'do-not-file',
      inputs: [],
    });
    assert.match(out, /OWE/);
    assert.match(out, /DO NOT FILE/);
  });

  it('renders MUST FILE for mandatory-file recommendation', () => {
    const out = render({
      year: 2025,
      refundOrOwe: 'owe',
      amountNis: 1200,
      recommendation: 'mandatory-file',
      inputs: [],
    });
    assert.match(out, /MUST FILE/);
  });

  it('formats count + points inputs without a ₪ sign', () => {
    const out = render({
      year: 2024,
      refundOrOwe: 'refund',
      amountNis: 1000,
      recommendation: 'file',
      inputs: [
        { label: 'Months worked', value: 7, source: 'form-106:months', kind: 'count' },
        { label: 'Credit points', value: 2.75, source: 'rules:base', kind: 'points' },
      ],
    });
    assert.match(out, /Months worked: 7 {3}\[/);
    assert.match(out, /Credit points: 2\.75 pts/);
    assert.doesNotMatch(out, /Months worked: .*₪/);
  });

  it('inserts blank line between recommendation and inputs section', () => {
    const out = render({
      year: 2024,
      refundOrOwe: 'refund',
      amountNis: 100,
      recommendation: 'file',
      inputs: [{ label: 'X', value: 1, source: 's', kind: 'count' }],
    });
    assert.match(out, /Recommendation: FILE — claim the refund\n\nBottom-line inputs/);
  });
});
