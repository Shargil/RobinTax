// Mode A — independent, blind, different-model cross-check.
// Library: verifyClaim(claim, modelRunner, model).
// CLI:     node --experimental-strip-types verify.ts <claim.json> [--model haiku|sonnet]
//
// The verifier prompt deliberately omits the primary answer — no anchoring.
// The verdict (agree/disagree/uncertain) is pure code in compare.ts — no LLM-as-judge.
// See Calculator/decisions/ADR-001.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compare, parseValue, type ClaimType, type Tolerance, type Verdict } from './compare.ts';
import { claudeRunner, type ModelRunner } from './runner.ts';

export interface Claim {
  id: string;
  question: string;
  evidence: string;
  type: ClaimType;
  original: { value: number | string; source: string };
  tolerance?: Tolerance;
}

export interface VerificationResult {
  id: string;
  verdict: Verdict;
  original: number | string;
  independent: number | string | null;
  delta: number | null;
  model: string;
  checkedAt: string;
  rawResponse?: string;
}

const VERIFIER_INSTRUCTIONS = `You are an independent fact-checker. Answer the question using ONLY the evidence below.
Reply with the answer alone — no explanation, no surrounding text, no units beyond what is asked.
If the evidence does not contain the answer, reply exactly: UNKNOWN.

`;

export function buildPrompt(claim: Claim): string {
  // CRITICAL: must NOT mention claim.original.value — blind verification.
  return (
    VERIFIER_INSTRUCTIONS +
    `Question: ${claim.question}\n\n` +
    `Evidence:\n"""\n${claim.evidence}\n"""\n`
  );
}

export async function verifyClaim(
  claim: Claim,
  modelRunner: ModelRunner = claudeRunner,
  model: string = 'haiku',
): Promise<VerificationResult> {
  const prompt = buildPrompt(claim);
  const raw = await modelRunner(model, prompt);
  const parsed = parseValue(claim.type, raw);
  const { verdict, delta } = compare(claim.type, claim.original.value, parsed, claim.tolerance);
  const rawTrimmed = raw.trim().slice(0, 200);
  return {
    id: claim.id,
    verdict,
    original: claim.original.value,
    independent: parsed,
    delta,
    model,
    checkedAt: new Date().toISOString(),
    rawResponse: rawTrimmed === String(parsed) ? undefined : rawTrimmed,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const modelIdx = args.indexOf('--model');
  const model = modelIdx >= 0 ? args[modelIdx + 1] : 'haiku';
  const claimPath = args.find((a, i) => !a.startsWith('--') && i !== modelIdx + 1);
  if (!claimPath) {
    console.error('usage: verify.ts <claim.json> [--model haiku|sonnet]');
    process.exit(2);
  }
  const claim: Claim = JSON.parse(await readFile(claimPath, 'utf8'));
  const result = await verifyClaim(claim, claudeRunner, model);
  console.log(JSON.stringify(result, null, 2));
  // Exit code: 0 agree, 1 disagree, 2 uncertain — lets the skill branch in shell.
  process.exit(result.verdict === 'agree' ? 0 : result.verdict === 'disagree' ? 1 : 2);
}
