// CLI wrapper around `calculate`. JSON in → YearResult JSON out (with trace).
// Exit codes:
//   0 = computed (stdout = YearResult JSON)
//   1 = blocked  (stderr = one-line reason; rules unverified OR settlements file missing)
//   2 = bad input or unexpected error (stderr = message; skill bug, fix before retry)
// Matches the verify.ts / render.ts CLI pattern.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { calculate, type YearInput, type YearResult } from './calculate.ts';
import { readRules, type SupportedYear } from '../rules/load.ts';
import type { YearSettlements } from '../rules/settlements/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Run the engine on a YearInput. Reads rules + settlements off disk by year.
 * Throws on:
 *   - missing/invalid `tax_year` (skill should treat as bad-input)
 *   - `readRules` sign-off failure (blocked)
 *   - missing rules/<year>.ts or settlements/<year>.ts (blocked)
 *   - any other engine error (treat as bad-input)
 */
export async function runFromInput(input: YearInput): Promise<YearResult> {
  if (!input || typeof input !== 'object') {
    throw new TypeError('input must be a YearInput object');
  }
  const year = (input as Partial<YearInput>).tax_year;
  if (typeof year !== 'number' || !Number.isFinite(year)) {
    throw new TypeError('input.tax_year must be a finite number');
  }
  const rules = await readRules(year as SupportedYear);
  const settlementsPath = resolve(HERE, `../rules/settlements/${year}.ts`);
  const settlementsMod = (await import(settlementsPath)) as { settlements: YearSettlements };
  return calculate(input, rules, settlementsMod.settlements);
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: run.ts <year-input.json>');
    process.exit(2);
  }

  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (e) {
    console.error(`run.ts: cannot read ${path}: ${(e as Error).message}`);
    process.exit(2);
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    console.error(`run.ts: ${path} is not valid JSON: ${(e as Error).message}`);
    process.exit(2);
  }

  try {
    const result = await runFromInput(input as YearInput);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    const err = e as Error & { code?: string };
    const msg = err.message ?? String(e);
    const isBlocked =
      err.code === 'ERR_MODULE_NOT_FOUND' ||
      /sign_off|refuses to compute/i.test(msg);
    // Collapse to one line — readRules formats multi-line failures, but the skill
    // wants a single string for the blocked footer.
    const oneLine = msg.split('\n').map((s) => s.trim()).filter(Boolean).join(' — ');
    console.error(oneLine);
    process.exit(isBlocked ? 1 : 2);
  }
}
