// Loader + invariant validation for year rule tables.
// readRules(year, opts) throws on schema / invariant violations and (by default)
// on `verification.sign_off !== 'verified'` — so the engine refuses to compute
// against an unreviewed year.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Bracket, Cited, YearRules } from './types.ts';

const SUPPORTED_YEARS = [2020, 2021, 2022, 2023, 2024, 2025] as const;
export type SupportedYear = (typeof SUPPORTED_YEARS)[number];

export interface ReadRulesOptions {
  /**
   * If true (default), throw when `verification.sign_off !== 'verified'`.
   * The engine should keep this on. Tooling (yoy-diff, partial review) may turn it off.
   */
  requireVerified?: boolean;
}

/** Resolve and dynamic-import the year's rules file, then validate. */
export async function readRules(
  year: SupportedYear,
  opts: ReadRulesOptions = {},
): Promise<YearRules> {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, `./${year}.ts`);
  // Dynamic import — TS modules under --experimental-strip-types.
  const mod = await import(path);
  const rules = (mod.rules ?? mod.default) as YearRules;
  if (!rules) throw new Error(`rules/${year}.ts must export \`rules\` (or default)`);
  return validate(rules, opts);
}

/** Pure validator — exported so tests can pass an in-memory fixture. */
export function validate(rules: YearRules, opts: ReadRulesOptions = {}): YearRules {
  const { requireVerified = true } = opts;
  const errors: string[] = [];

  // Top-level shape
  if (typeof rules.tax_year !== 'number') errors.push('tax_year must be a number');
  if (!rules.citations || typeof rules.citations !== 'object') errors.push('citations missing');
  if (!rules.verification) errors.push('verification missing');

  // Sign-off gating (engine must not run on unreviewed years).
  if (requireVerified && rules.verification?.sign_off !== 'verified') {
    errors.push(
      `verification.sign_off='${rules.verification?.sign_off}' — engine refuses to compute. ` +
        `Populate sources, set sign_off='verified' after review.`,
    );
  }

  // Citation resolution: every `cite` key must exist in `citations`.
  for (const [field, val] of Object.entries(rules)) {
    if (isCited(val) && !rules.citations?.[val.cite]) {
      errors.push(`${field}.cite='${val.cite}' does not resolve in citations{}`);
    }
  }

  // Brackets: strictly increasing thresholds (with null only at the end),
  // strictly increasing rates, all rates in [0,1].
  const brackets = rules.brackets?.value;
  if (!Array.isArray(brackets) || brackets.length === 0) {
    errors.push('brackets.value must be a non-empty array');
  } else {
    validateBrackets(brackets, errors);
  }

  // Point value: sane band.
  const pv = rules.point_value_annual?.value;
  if (typeof pv !== 'number' || pv < 1500 || pv > 5000) {
    errors.push(`point_value_annual (${pv}) outside sane band [1500, 5000] NIS/year`);
  }
  const pvm = rules.point_value_monthly?.value;
  if (typeof pvm !== 'number' || Math.abs(pv / 12 - pvm) > 1) {
    errors.push(`point_value_monthly (${pvm}) inconsistent with annual / 12`);
  }

  // Separate rates in [0,1].
  const sr = rules.separate_rates?.value;
  if (sr) {
    for (const [k, v] of Object.entries(sr)) {
      if (typeof v !== 'number' || v < 0 || v > 1) errors.push(`separate_rates.${k}=${v} out of [0,1]`);
    }
  }

  // Donation rule
  const d = rules.donation?.value;
  if (d) {
    if (d.rate <= 0 || d.rate > 1) errors.push(`donation.rate (${d.rate}) out of (0,1]`);
    if (d.max_eligible_share_of_taxable_income <= 0 || d.max_eligible_share_of_taxable_income > 1) {
      errors.push('donation.max_eligible_share_of_taxable_income out of (0,1]');
    }
  }

  // Mandatory filing
  const mf = rules.mandatory_filing?.value;
  if (mf) {
    if (!(mf.gross_salary_nis > 0)) errors.push('mandatory_filing.gross_salary_nis must be > 0');
    if (!(mf.all_source_taxable_nis > 0)) errors.push('mandatory_filing.all_source_taxable_nis must be > 0');
  }

  if (errors.length) {
    throw new Error(
      `YearRules for tax_year=${rules.tax_year} failed validation:\n` +
        errors.map((e) => `  - ${e}`).join('\n'),
    );
  }
  return rules;
}

function isCited(v: unknown): v is Cited<unknown> {
  return (
    typeof v === 'object' && v !== null && 'value' in v && 'cite' in v && typeof (v as { cite: unknown }).cite === 'string'
  );
}

function validateBrackets(brackets: Bracket[], errors: string[]): void {
  let prevUpTo = -Infinity;
  let prevRate = -Infinity;
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i];
    const isLast = i === brackets.length - 1;
    if (b.rate < 0 || b.rate > 1) errors.push(`brackets[${i}].rate=${b.rate} out of [0,1]`);
    if (b.rate <= prevRate) errors.push(`brackets[${i}].rate=${b.rate} not strictly > previous (${prevRate})`);
    prevRate = b.rate;
    if (b.upTo === null) {
      if (!isLast) errors.push(`brackets[${i}].upTo=null only allowed on the last (top) bracket`);
    } else {
      if (b.upTo <= prevUpTo) errors.push(`brackets[${i}].upTo=${b.upTo} not strictly > previous (${prevUpTo})`);
      prevUpTo = b.upTo;
    }
  }
}
