---
name: calc-refund
description: Worker skill for RobinTax's Calculate-refund stage. Use when the user invokes `/calc-refund` or when `robintax` routes here after the collect stage is sufficiently complete. Computes per-year refund/owe + a file/don't-file/mandatory-file recommendation, second-checking every load-bearing value (blind, different-model cross-check) and human-confirming every bottom line before any filing handoff. Slash-command or router-invoked only — do NOT auto-fire on phrases like "calculate my refund".
---

# calc-refund — per-year refund computation, with second-check

## Goal

For each finished tax year the user has docs for, compute the refund (or owe), and recommend **file / don't-file / mandatory-file** — never silently committing to a number. Second-check every load-bearing value; always have the user confirm the bottom line.

## When to use

- The user invokes `/calc-refund` directly.
- `robintax` routes here when the `Collect documents` stage is far enough (per the journey ledger) to compute at least one year.

## Preflight (silent if green, hard-stop if red)

Before reading the ledger: `node --version`. If output is < `v22.6.0`, **stop and surface the install command for the user's platform**, then exit. Do not proceed; the engine uses `--experimental-strip-types` which only exists in 22.6+.

- macOS: `brew install node@22 && brew link --overwrite --force node@22`
- Windows: `winget install OpenJS.NodeJS.LTS`
- Linux: use nvm — `nvm install 22 && nvm use 22`

If green (≥ 22.6), say nothing and continue.

## Read at start (ADR-011)

Read `<memory>/journey.md`. Classify each year the user has at least one source doc for as **computable** (rules `verified` + sufficient docs) or **blocked** (rules unverified, or a required source doc missing). Do **not** pre-announce this classification — it appears in the results, not in a pre-flight message. If literally zero years are computable, that's the one exception: say so briefly and route back to `get-doc`.

## One consent, one report

`/calc-refund` is itself the consent. Do **not** ask "Continue?" before computing. Do **not** pre-announce which years are computable vs. blocked. Run the math on every computable year in a single pass, then render **one combined report** covering every year the user has docs for:
- Computable years → numbers + recommendation.
- Blocked years → one-line `cannot compute — <reason>` (e.g. "rules table for 2023 not yet signed off in `Calculator/rules/2023.ts`").

The bottom-line confirm happens **once**, on the combined report — not per year. The only mid-run questions allowed are data-fidelity questions when `verify.ts` returns `disagree` / `uncertain` and a real value needs picking.

## Rules

- **Math is deterministic.** Never let the model do the bracket arithmetic, credit-point math, or refund subtraction. See Calculator/decisions/ADR-001.
- **Every load-bearing value gets Mode A** — silent unless it disagrees (don't nag — memory `feedback_approval_frequency`).
- **The combined report's bottom line gets Mode B — once.** All computed years' numbers go into one render block; ask y/n once on the combined block, not per year. Filing is irreversible (Repo ADR-010), but `/calc-refund` itself doesn't file — so one combined sign-off is enough at this stage.
- **Owe → recommend DO NOT FILE** *unless* a mandatory-filing trigger applies — then recommend MUST FILE and surface the trigger.
- **Conservative on missing data.** If a 106 or BTL is missing for a year, flag it and produce a low/high band; never silently zero a source.
- **Never proxy credentials** (Repo ADR-001); no PII or credentials in the journey ledger.

## Every input to the engine is a verified claim

**Principle.** Every value that flows into `YearInput` is a verified claim. If no claim template fits the value, **stop and tell the user** — the skill is missing coverage for their case. Never quietly hand the engine an unverified value.

That covers — without enumeration — income, withheld, every credit-point category, qualifying months, every eligibility flag, every mandatory-filing input. Any new edge case is a new *instance* of a template, not a new template.

### The four templates (one per `ClaimType` in `verifier/compare.ts`)

| Template | `ClaimType` | Question stencil | Example uses |
|---|---|---|---|
| **`amount`** | `currency` | "What is the value of field `<X>` in this `<doc>`?" | 106 field 158/172, 106 field 042, BTL gross, BTL withheld, donation receipt total |
| **`enum`** | `enum` | "Is `<thing>` a `<category>` in tax year `<Y>`? yes/no/unknown" | settlement §11 qualifies, mandatory-filing trigger fires, BTL benefit is taxable |
| **`points`** | `credit_points` | "How many `<section>` credit points apply in tax year `<Y>`, given `<facts>`?" | §39A soldier, §35 immigrant, §40 children, §40C degree, single-parent |
| **`count`** | `integer` | "How many `<unit>` of `<thing>` fall in tax year `<Y>` given `<dates>`?" | residency months, employment months, eligible children |

Each claim needs: (a) a focused question, (b) `evidence` that contains *everything* needed to answer (source doc text + relevant rule snippet for eligibility claims), (c) the primary answer in `original.value`. The verifier prompt is blind — `verify.ts` enforces this; do not paste the primary answer into `evidence`.

Mode A is silent on `agree`. On `disagree` or `uncertain`, surface both candidate values + sources to the user; ask which is right; re-run the engine input with the resolution.

## Bottom-line values (Mode B targets — always)

The renderer produces a step-by-step **walkthrough** per year — income → withheld → taxable → brackets → credits → liability → refund — so the user can debug each line. Build one `BottomLine` per computed year from `YearResult` + `YearResult.trace` (the engine exposes the per-bracket, per-credit, with-cap detail; you only add doc-side labels and source provenance), then assemble one `Report` and render once.

Per computed year (`BottomLine`):
1. The final **refund / owe** figure (NIS, absolute value + a `refundOrOwe` sign field).
2. The **file / don't-file / mandatory-file** recommendation (copy from `YearResult.recommendation`).
3. `income.rows[]` — one row per source (employer/BTL/etc.) with `{ label, amount, source }`. Label is human-readable (e.g. *"Employer מדרשת שדה בוקר (952011039)"*); `source` is the doc path (e.g. *"106_2025_1.pdf"*). Amounts come from `YearResult.trace.income.sources`.
4. `withheld.rows[]` — same shape, from `trace.withheld.sources`.
5. `taxable` — `{ gross, pensionDeduction, taxable }` from `trace.taxable`.
6. `brackets[]` — pass through `trace.brackets` verbatim.
7. `basicTax` — sum of `trace.brackets[].taxAdded` (deterministic).
8. `surtax` — only set if `trace.surtax.tax > 0`; otherwise omit.
9. `credits` — `{ points, pension?, settlement?, donation?, total }`. Each sub-field maps 1:1 from the matching trace sub-tree. `total` = sum of `points.creditAmount + pension.credit + settlement.discount + donation.credit` (deterministic; renderer uses this for the "What you should have paid" subtraction).
10. `liability` = `trace.recommendation.liability`.
11. `mandatoryTriggers[]` = `trace.recommendation.triggers`.
12. `notes[]` — free-form caveats (e.g. residency-window context, missing-source flags).

Plus, across the whole run:
13. The **combined refund/owe** figure — signed sum of **rounded** per-year amounts (so `7,334 + 11,145 = 18,479` not `18,478` from raw floats). Compute as: `combinedRefundNis = computed.reduce((s, bl) => s + Math.round(bl.amountNis) * (bl.refundOrOwe === 'owe' ? -1 : 1), 0)`.
14. One line per **blocked year** with the reason it couldn't compute.

Render: `node --experimental-strip-types "${CLAUDE_PLUGIN_ROOT:-.}/Calculator/verifier/render.ts" <report.json>`. The renderer produces the cover headline from `combinedRefundNis`, formats every per-bracket line and every credit-formula line itself, and prints one trailing "Confirm? (y/n)". Relay the single rendered block.

## Checklist

1. Read journey ledger. Enumerate **all** years where the user has at least one source doc (from the Documents section). Classify each as **computable** or **blocked** (per "Read at start") — but don't show the user this classification yet.
2. For each **computable** year, in one pass (parallelize where possible):
   - a. For each value about to enter `YearInput`, instantiate the matching template from "Every input to the engine is a verified claim". If no template fits, **stop and tell the user** — the skill is missing coverage. Do not quietly type a value into the engine input.
   - b. For each claim: `node --experimental-strip-types "${CLAUDE_PLUGIN_ROOT:-.}/Calculator/verifier/verify.ts" <claim.json> --model haiku`. Default verifier model: `haiku` (different family from the primary `opus`). Use `sonnet` for higher-stakes claims. Exit code 0 = agree, 1 = disagree, 2 = uncertain.
   - c. On `disagree` / `uncertain`: surface both candidate values to the user, ask which is right, re-run the engine input. (This is the one allowed mid-run question — it's a data-fidelity question, not an approval gate.)
   - d. Compute via `node --experimental-strip-types "${CLAUDE_PLUGIN_ROOT:-.}/Calculator/engine/run.ts" <year-input.json>`. JSON in (a `YearInput`), JSON out (a `YearResult` with `trace`). Exit codes: `0` → success, parse stdout as `YearResult`; `1` → year is blocked, capture stderr (one line) as the `blocked[].reason` for the combined report; `2` → bad input or unexpected error — that's a skill bug, fix before retry. Do **not** hand-write a TS driver that imports `calculate`/`readRules`/settlements directly; use the CLI.
   - e. Detect mandatory-filing triggers (high income, two employers above threshold without תיאום מס, capital gains, foreign income). Surface inline in that year's row.
3. Build one `Report` JSON: `computed[]` = one `BottomLine` per computable year (mapped 1:1 from `YearResult` + `YearResult.trace` per the **Bottom-line values** section above), `blocked[]` = one `{year, reason}` per blocked year, `combinedRefundNis` = signed sum of **rounded** `computed[].amountNis`. Render the whole thing in one call: `node --experimental-strip-types "${CLAUDE_PLUGIN_ROOT:-.}/Calculator/verifier/render.ts" <report.json>`. The output is the full combined block: cover headline → per-year walkthroughs (income/withheld/taxable/brackets/credits/liability/refund) → blocked footer → one "Confirm? (y/n)".
4. Ask **once**: y/n on the combined block.
5. **Only after confirm**, write per-year results to the ledger's `Calculate refund` stage.
6. Stage status: `complete` if every year-with-docs is either confirmed-computed or has a definitive blocked reason; otherwise `in-progress`.

## Update at end (ADR-011)

Section-scoped read-modify-write. Stamp `Last updated: <YYYY-MM-DD> by calc-refund (<short note>)`.

## Anti-patterns

- Don't ask the model "do these two numbers agree?" — the verdict is code (`compare.ts`).
- Don't include the primary answer in the verifier prompt — it must be **blind** (`verify.ts` enforces this; don't bypass).
- Don't render the bottom line by paraphrasing in chat — always go through `render.ts` so the numbers can't drift. This applies to the **combined total** too: build `Report.combinedRefundNis` as a signed sum of *rounded* `computed[].amountNis` and let `renderReport` print it. Never type the combined number into chat.
- Don't hand-format any of the walkthrough's intermediate lines (per-bracket math, "eligible base capped at...", "× rate × months/12", "Basic tax − credits = liability"). All of those come from `BottomLine` fields the engine populated and the renderer formats. If a number on screen doesn't match the trace, the bug is the mapping, not the renderer.
- Don't call `render.ts` once per year and stitch the output yourself — that puts the cover headline and the blocked-years footer outside the renderer. Build one `Report`, render once.
- Don't auto-fire on phrases like "calculate my refund"; require `/calc-refund` or a `robintax` route.
- Don't write PII or credentials into the journey ledger.
- **Don't pre-announce.** When `/calc-refund` fires, go straight to the combined results. No "here's what we'll do" preamble, no "computable years are X, blocked are Y, ok to start?" message.
- **Don't gate per-year.** One combined confirm at the end covers all years. The only mid-run questions allowed are data-fidelity questions when `verify.ts` returns `disagree` / `uncertain`.

## Related

- [Calculator/CLAUDE.md](../../Calculator/CLAUDE.md) and [ADR-001](../../Calculator/decisions/ADR-001-second-check-verifier.md).
- [Repo ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — gate scary actions.
- [Repo ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md) — journey ledger contract.
- `robintax` skill (`.claude/skills/robintax/`) — routes here for the calculate stage.
