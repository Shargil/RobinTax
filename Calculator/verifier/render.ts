// Mode B — deterministic walkthrough render of a per-year bottom line.
// Pure function: structured BottomLine → fixed text block.
// Used so the user sees the *computed* numbers verbatim, not an LLM paraphrase,
// and can debug the calc step by step (income → tax → credits → refund).
// Claude (the skill runner) relays this and collects y/n in-conversation per ADR-010.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export type RefundOrOwe = 'refund' | 'owe' | 'zero';
export type Recommendation = 'file' | 'do-not-file' | 'mandatory-file' | 'uncertain';

/**
 * One year's worksheet. Built by `calc-refund` from `YearResult` + `YearResult.trace`,
 * plus the doc/source labels (which the engine doesn't know — they come from the skill's
 * mapping of `YearInput` → collected docs).
 */
export interface BottomLine {
  year: number;
  refundOrOwe: RefundOrOwe;
  /** Absolute value; sign carried by `refundOrOwe`. Mirrors abs(trace.recommendation.refund_or_owe). */
  amountNis: number;
  recommendation: Recommendation;

  income: { rows: Array<{ label: string; amount: number; source: string }>; total: number };
  withheld: { rows: Array<{ label: string; amount: number; source: string }>; total: number };
  taxable: { gross: number; pensionDeduction: number; taxable: number };

  brackets: Array<{ upTo: number | null; rate: number; widthApplied: number; taxAdded: number }>;
  basicTax: number;
  /** Omit if `surtax.tax === 0`. */
  surtax?: { threshold: number; rate: number; appliedTo: number; tax: number };

  credits: {
    points: {
      base: number;
      soldier: number;
      immigrant: number;
      degree: number;
      single_parent: number;
      total: number;
      pointValueAnnual: number;
      creditAmount: number;
    };
    /** Omit if no pension self-deposit. */
    pension?: {
      depositLifeInsurance: number;
      depositPensionFund: number;
      creditBaseCeiling: number;
      lifeEligible: number;
      pensionEligible: number;
      rateLifeInsurance: number;
      ratePensionFund: number;
      credit: number;
    };
    /** Omit if no residency input. */
    settlement?: {
      settlementHe: string;
      rate: number;
      ceiling: number;
      qualifyingMonths: number;
      eligibleIncome: number;
      monthsShare: number;
      discount: number;
      /**
       * Residency date range that produced `qualifyingMonths`, in `DD/MM/YYYY` form.
       * Optional so older callers/fixtures don't break — when present, the renderer
       * prints it inline so the user sees WHERE the month count came from.
       */
      dateFrom?: string;
      dateTo?: string;
    };
    /** Omit if no donations. */
    donation?: {
      donated: number;
      rate: number;
      eligible: number;
      credit: number;
    };
    /** Sum of all credit amounts: creditAmount + pension.credit + settlement.discount + donation.credit. */
    total: number;
  };

  /** What you should have paid: max(0, basicTax + surtax − credits.total). */
  liability: number;
  mandatoryTriggers: string[];
  notes?: string[];
}

export interface BlockedYear {
  year: number;
  /** One-line reason, e.g. "rules table for 2023 not yet signed off in Calculator/rules/2023.ts". */
  reason: string;
}

/**
 * Combined multi-year report. `combinedRefundNis` is the signed sum of per-year refunds
 * (positive = refund, negative = owe) — built deterministically by the skill, never typed.
 */
export interface Report {
  computed: BottomLine[];
  blocked: BlockedYear[];
  combinedRefundNis: number;
}

// We format manually instead of using Intl currency formatting so the output has
// no RTL/BIDI marks (Intl.NumberFormat('he-IL', { currency: 'ILS' }) inserts U+200F
// around the ₪ and digits, which renders as visible "‏" characters in monospace logs).
const THOUSANDS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const NIS = { format: (n: number) => `₪${THOUSANDS.format(n)}` };

const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  'file': 'FILE — claim the refund',
  'do-not-file': 'DO NOT FILE — you would owe',
  'mandatory-file': 'MUST FILE — legally required even if you owe',
  'uncertain': 'UNCERTAIN — review inputs before deciding',
};

const RULE = '─'.repeat(60);

const nis = (n: number) => NIS.format(Math.round(n));
const pct = (r: number) => `${(r * 100).toFixed(r * 100 < 10 ? 1 : 0).replace(/\.0$/, '')}%`;

/** Bold (Markdown — renderer in chat shows it bold; safe in monospace tools too). */
const b = (s: string) => `**${s}**`;

// BiDi: mixing Hebrew with LTR amounts/parens/brackets mid-line scrambles
// visually. Extract Hebrew from the label and push it to the very END of the
// rendered line, where no LTR text follows it.
const HEBREW_RUN = /[֐-׿][֐-׿\s'"׳״]*[֐-׿]|[֐-׿]/;
function splitHebrewTail(label: string): { ltr: string; he: string } {
  const m = label.match(HEBREW_RUN);
  if (!m) return { ltr: label, he: '' };
  const he = m[0].trim();
  const ltr = label.replace(m[0], ' ')
    .replace(/\(\s*\)/g, '')         // empty parens left by extraction
    .replace(/\s+—\s+/g, ' ')        // stray em-dash separators
    .replace(/—\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { ltr, he };
}

function renderRow(label: string, value: string, source: string): string {
  const { ltr, he } = splitHebrewTail(label);
  const tail = he ? `   (${he})` : '';
  return `  • ${ltr}: ${value}   [${source}]${tail}`;
}

function renderIncomeBlock(bl: BottomLine): string[] {
  const lines = ['Taxed Income:'];
  for (const r of bl.income.rows) {
    lines.push(renderRow(r.label, nis(r.amount), r.source));
  }
  lines.push(`  Total: ${b(nis(bl.income.total))}`);
  return lines;
}

function renderWithheldBlock(bl: BottomLine): string[] {
  const lines = ['Tax paid:'];
  for (const r of bl.withheld.rows) {
    lines.push(renderRow(r.label, nis(r.amount), r.source));
  }
  lines.push(`  Total: ${b(nis(bl.withheld.total))}`);
  return lines;
}

function renderTaxableBlock(bl: BottomLine): string[] {
  // Skip when there's no pension §47 deduction — the section would just restate
  // gross income, which the Taxed Income block already shows.
  if (bl.taxable.pensionDeduction === 0) return [];
  return [
    'Taxable income:',
    `  ${nis(bl.taxable.gross)} gross − ${nis(bl.taxable.pensionDeduction)} pension §47 deduction = ${b(nis(bl.taxable.taxable))}`,
  ];
}

function renderBracketsBlock(bl: BottomLine): string[] {
  const lines = ['Basic tax (by bracket):'];
  const rows: Array<{ lo: string; hi: string; rate: string; tax: string }> = [];
  let prevTop = 0;
  for (const br of bl.brackets) {
    if (br.widthApplied === 0) {
      prevTop = br.upTo ?? prevTop;
      continue;
    }
    rows.push({
      lo: nis(prevTop),
      hi: nis(prevTop + br.widthApplied),
      rate: pct(br.rate),
      tax: nis(br.taxAdded),
    });
    prevTop = br.upTo ?? prevTop;
  }
  if (rows.length > 0) {
    // Borderless mini-table: every column left-aligned (padEnd) so the leading character
    // of each cell — the ₪ in the range, the digit in the percentage, the ₪ in the tax —
    // sits at a fixed column across rows. Right-aligning (padStart) would line up the
    // *right* edge instead, which the user finds visually unanchored.
    const loW = Math.max(...rows.map((r) => r.lo.length));
    const hiW = Math.max(...rows.map((r) => r.hi.length));
    const rateW = Math.max(...rows.map((r) => r.rate.length));
    for (const r of rows) {
      lines.push(
        `  ${r.lo.padEnd(loW)} – ${r.hi.padEnd(hiW)}   × ${r.rate.padEnd(rateW)}   →   ${r.tax}`,
      );
    }
  }
  lines.push(`  Basic tax: ${b(nis(bl.basicTax))}`);
  if (bl.surtax && bl.surtax.tax > 0) {
    lines.push(
      '',
      `Surtax (מס יסף): income above ${nis(bl.surtax.threshold)} = ${nis(bl.surtax.appliedTo)} × ${pct(bl.surtax.rate)} = ${b(nis(bl.surtax.tax))}`,
    );
  }
  return lines;
}

function renderCreditsBlock(bl: BottomLine): string[] {
  const c = bl.credits;
  const lines: string[] = ['Credits (זיכויים):'];

  // Credit points
  const ptsBreakdown: string[] = [];
  if (c.points.base) ptsBreakdown.push(`base ${c.points.base}`);
  if (c.points.soldier) ptsBreakdown.push(`soldier ${c.points.soldier}`);
  if (c.points.immigrant) ptsBreakdown.push(`immigrant ${c.points.immigrant}`);
  if (c.points.degree) ptsBreakdown.push(`degree ${c.points.degree}`);
  if (c.points.single_parent) ptsBreakdown.push(`single-parent ${c.points.single_parent}`);
  const ptsTrace = ptsBreakdown.length > 1 ? `   (${ptsBreakdown.join(' + ')})` : '';
  lines.push(
    `  • Credit points: ${c.points.total} pts × ${nis(c.points.pointValueAnnual)}/pt = ${b(nis(c.points.creditAmount))}${ptsTrace}`,
  );

  // Pension §45A
  if (c.pension) {
    const p = c.pension;
    const deposit = p.depositLifeInsurance + p.depositPensionFund;
    const totalEligible = p.lifeEligible + p.pensionEligible;
    const cappedNote =
      deposit > p.creditBaseCeiling
        ? ` (capped at §45A ceiling ${nis(p.creditBaseCeiling)})`
        : '';
    // Pick the dominant category for the formula line — most users only use one.
    if (p.pensionEligible > 0 && p.lifeEligible === 0) {
      lines.push(
        `  • Pension §45A: ${nis(p.depositPensionFund)} deposited → eligible ${nis(p.pensionEligible)}${cappedNote} × ${pct(p.ratePensionFund)} = ${b(nis(p.credit))}`,
      );
    } else if (p.lifeEligible > 0 && p.pensionEligible === 0) {
      lines.push(
        `  • Pension §45A: ${nis(p.depositLifeInsurance)} life-insurance deposited → eligible ${nis(p.lifeEligible)}${cappedNote} × ${pct(p.rateLifeInsurance)} = ${b(nis(p.credit))}`,
      );
    } else {
      lines.push(
        `  • Pension §45A: ${nis(p.lifeEligible)} life × ${pct(p.rateLifeInsurance)} + ${nis(p.pensionEligible)} pension × ${pct(p.ratePensionFund)} = ${b(nis(p.credit))}${cappedNote}`,
      );
    }
    void totalEligible;
  }

  // Settlement §11
  if (c.settlement) {
    const s = c.settlement;
    const clampNote =
      s.eligibleIncome < s.ceiling
        ? `${nis(s.eligibleIncome)} taxable < ${nis(s.ceiling)} ceiling`
        : `taxable capped at ${nis(s.ceiling)} ceiling`;
    // Print the date range that produced the month count so the user can audit it
    // without scrolling to Notes. Format: `(01/01/2025 – 05/10/2025)`.
    const dateRange =
      s.dateFrom && s.dateTo ? `   (resident ${s.dateFrom} – ${s.dateTo})` : '';
    lines.push(
      `  • Settlement: ${clampNote}`,
      `    → eligible ${nis(s.eligibleIncome)} × ${pct(s.rate)} × ${s.qualifyingMonths}/12 months = ${b(nis(s.discount))}   (${s.settlementHe})${dateRange}`,
    );
  }

  // Donation §46
  if (c.donation) {
    const d = c.donation;
    lines.push(
      `  • Donation §46: ${nis(d.donated)} donated → eligible ${nis(d.eligible)} × ${pct(d.rate)} = ${b(nis(d.credit))}`,
    );
  }

  lines.push(`  Total credits: ${b(nis(c.total))}`);
  return lines;
}

function renderWhatYouOwe(bl: BottomLine): string[] {
  const surtaxTerm = bl.surtax && bl.surtax.tax > 0 ? ` + surtax ${nis(bl.surtax.tax)}` : '';
  return [
    'What you should have paid:',
    `  Basic tax ${nis(bl.basicTax)}${surtaxTerm} − credits ${nis(bl.credits.total)} = ${b(nis(bl.liability))}`,
  ];
}

function renderRefund(bl: BottomLine): string[] {
  const verb = bl.refundOrOwe === 'owe' ? 'Tax owed' : 'Tax refund';
  const sign = bl.refundOrOwe === 'owe' ? '−' : '';
  // Bracket the final refund/owe pair with rules so it visually anchors at the bottom
  // of each year — matches the rules bracketing the Year headline at the top.
  return [
    RULE,
    `${verb}:`,
    `  Withheld ${nis(bl.withheld.total)} − what you should have paid ${nis(bl.liability)} = ${b(sign + nis(bl.amountNis))}   ◀━ ${bl.refundOrOwe.toUpperCase()}`,
    RULE,
  ];
}

/**
 * Per-year walkthrough. The Year headline and the final Tax-refund block are each
 * bracketed by `RULE` lines (top + bottom) so the eye anchors on the two most
 * load-bearing lines. No other rules in the walkthrough.
 */
function renderYearWalkthrough(bl: BottomLine): string[] {
  const headline =
    bl.refundOrOwe === 'zero'
      ? `Year ${bl.year}: ≈ ₪0 (preliminary)`
      : `Year ${bl.year}: ${bl.refundOrOwe.toUpperCase()} ${NIS.format(bl.amountNis)} (preliminary)`;

  const lines: string[] = [RULE, headline, RULE];
  // Surface the recommendation line only when it's NOT the happy "file → claim refund"
  // case — that one is already implied by the REFUND headline.
  if (bl.recommendation !== 'file') {
    lines.push(`Recommendation: ${RECOMMENDATION_LABEL[bl.recommendation]}`);
  }
  lines.push('');
  lines.push(...renderIncomeBlock(bl), '');
  lines.push(...renderWithheldBlock(bl), '');
  const taxable = renderTaxableBlock(bl);
  if (taxable.length) lines.push(...taxable, '');
  lines.push(...renderBracketsBlock(bl), '');
  lines.push(...renderCreditsBlock(bl), '');
  lines.push(...renderWhatYouOwe(bl), '');
  lines.push(...renderRefund(bl));

  if (bl.notes?.length) {
    lines.push('', 'Notes:', ...bl.notes.map((n) => `  - ${n}`));
  }
  if (bl.mandatoryTriggers.length) {
    lines.push('', 'Mandatory-filing triggers:', ...bl.mandatoryTriggers.map((t) => `  - ${t}`));
  }
  return lines;
}

export function render(bl: BottomLine): string {
  return [...renderYearWalkthrough(bl), '', 'Confirm these numbers? (y/n)'].join('\n');
}

/**
 * Render the combined multi-year report. Headline is computed from `combinedRefundNis`
 * so the cover total cannot drift from the per-year engine outputs. One "Confirm? (y/n)".
 */
export function renderReport(report: Report): string {
  const sign: RefundOrOwe =
    report.combinedRefundNis > 1 ? 'refund' : report.combinedRefundNis < -1 ? 'owe' : 'zero';
  const yearCount = report.computed.length;
  const headline =
    sign === 'zero'
      ? `Combined across ${yearCount} year(s): ≈ ₪0 (preliminary)`
      : `Combined across ${yearCount} year(s): ${sign.toUpperCase()} ${NIS.format(Math.abs(report.combinedRefundNis))} (preliminary)`;

  // No outer rules around the combined headline or report tail — rules live ONLY
  // around per-year headlines and per-year refund blocks (those are the load-bearing
  // anchors). Eight blank lines between years to break the visual flow.
  const lines: string[] = [headline, ''];
  for (let i = 0; i < report.computed.length; i++) {
    lines.push(...renderYearWalkthrough(report.computed[i]));
    if (i < report.computed.length - 1) lines.push('', '', '', '', '', '', '', '');
  }
  if (report.blocked.length) {
    lines.push('', 'Blocked years (cannot compute yet):');
    for (const b of report.blocked) {
      lines.push(`  • ${b.year} — ${b.reason}`);
    }
  }
  lines.push('', 'Confirm these numbers? (y/n)');
  return lines.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: render.ts <bottomline-or-report.json>');
    process.exit(2);
  }
  const json = JSON.parse(await readFile(path, 'utf8'));
  console.log('computed' in json ? renderReport(json as Report) : render(json as BottomLine));
}
