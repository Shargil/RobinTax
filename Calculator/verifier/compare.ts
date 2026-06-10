// Pure comparison + parsing for the second-check verifier.
// The verdict is code — never an LLM judging agreement (see Calculator/decisions/ADR-001).

export type ClaimType = 'currency' | 'integer' | 'credit_points' | 'enum';
export type Verdict = 'agree' | 'disagree' | 'uncertain';

export interface Tolerance {
  absolute?: number;
  relative?: number;
}

const DEFAULT_TOLERANCE: Record<ClaimType, Tolerance> = {
  currency: { absolute: 1, relative: 0.005 },
  integer: { absolute: 0 },
  credit_points: { absolute: 0 },
  enum: {},
};

export function parseValue(type: ClaimType, raw: string): number | string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (/^unknown$/i.test(trimmed)) return null;

  if (type === 'enum') return trimmed.toLowerCase();

  const match = trimmed.replace(/[,_]/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  if (!Number.isFinite(n)) return null;

  if (type === 'integer') return Number.isInteger(n) ? n : null;
  if (type === 'credit_points') {
    // Israeli credit points come in 0.25 steps.
    return Math.round(n * 4) / 4 === n ? n : null;
  }
  return n;
}

export interface CompareResult {
  verdict: Verdict;
  delta: number | null;
}

export function compare(
  type: ClaimType,
  original: number | string,
  independent: number | string | null,
  override?: Tolerance,
): CompareResult {
  if (independent === null || independent === undefined) {
    return { verdict: 'uncertain', delta: null };
  }

  if (type === 'enum') {
    const a = String(original).trim().toLowerCase();
    const b = String(independent).trim().toLowerCase();
    return { verdict: a === b ? 'agree' : 'disagree', delta: null };
  }

  const a = Number(original);
  const b = Number(independent);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { verdict: 'uncertain', delta: null };
  }

  const delta = b - a;
  const t: Tolerance = { ...DEFAULT_TOLERANCE[type], ...(override ?? {}) };
  const absOk = t.absolute === undefined ? false : Math.abs(delta) <= t.absolute;
  const relOk =
    t.relative === undefined
      ? false
      : a === 0
        ? Math.abs(delta) <= (t.absolute ?? 0)
        : Math.abs(delta) / Math.abs(a) <= t.relative;

  // Agree if EITHER tolerance is satisfied: small absolute deltas absorb rounding;
  // small relative deltas absorb proportional error on large amounts.
  const within = absOk || relOk;
  return { verdict: within ? 'agree' : 'disagree', delta };
}
