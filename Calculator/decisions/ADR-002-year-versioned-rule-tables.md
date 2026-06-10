# ADR-002: Year-versioned ITA rule tables as typed TS modules with centralized citations and sign-off gating

**Date:** 2026-06-03
**Status:** accepted

## Context

The Calculator's deterministic-math layer needs the per-year ITA parameters that turn an income picture into a tax liability — bracket schedule, credit-point value, status credits (soldier, immigrant, settlement, etc.), donation/pension rules, separate-rate items for investment income, and mandatory-filing thresholds. These change every tax year via indexation, and the eligible-settlement list changes by political fiat. Getting any parameter wrong silently produces a wrong refund. The architecture is *deterministic math, LLM only at the edges, ITA as the final oracle*; the rule tables are the data the math layer consumes, and their correctness is a precondition for the engine being trustworthy.

## Decision

**One typed TypeScript module per tax year**, conforming to a shared `YearRules` interface (`Calculator/rules/types.ts`). Each year file exports a single `const rules: YearRules` and lives at `Calculator/rules/<YYYY>.ts`. Long lists (eligible settlements) live in sibling files at `Calculator/rules/settlements/<YYYY>.ts`. Source PDFs are archived in-repo under `Calculator/rules/sources/<YYYY>/` next to a `sources.md` manifest (URL + fetched date + SHA256).

**Centralized citations + cite-by-key.** Each year file has a top-level `citations: Record<string, Citation>` map. Every parameter carries `{ value, cite: '<citation-key>' }` rather than its own inline citation. The loader (`Calculator/rules/load.ts`) validates that every `cite` resolves to a key in `citations`.

**Sign-off gating.** Each year file has a `verification` block with `sign_off: 'verified' | 'partial' | 'unverified'`. The default `readRules(year)` throws on anything but `verified`, so the engine refuses to compute against an unreviewed year. Tooling (`yoy-diff`, partial review) can opt out with `requireVerified: false`.

**Two-source rule for high-stakes parameters.** Brackets and `point_value_annual` must be sourced from two independent ITA publications (the annual filing guide + the rates notice). They must match; disagreement is a forced human escalation.

**Defense in depth** for "we have the right rules":
1. One authoritative source per parameter (annual ITA guide / rates notice / ceilings notice / settlements annex / regulations + Ordinance for stable rules / Bituach Leumi rates). No blogs, no training data.
2. Two-source rule on brackets + point value.
3. Schema validation at load time (citation resolution; bracket monotonicity + rate strictly increasing; point value in a sane band [1500, 5000] NIS/year; annual≈monthly×12; separate rates in [0,1]; mandatory-filing thresholds > 0).
4. YoY structural diff (`rules/yoy-diff.ts`) reviewed by a human; flips `verification.yoy_diff_reviewed` to true after sign-off.
5. The verifier (Calculator/decisions/ADR-001) used for ambiguous reads off the archived PDF — blind, different-model, deterministic verdict.
6. Golden cases against the ITA simulator at the engine layer (next phase) — the outermost net.

## Why

- **Typed TS, not JSON+Zod**: the compiler catches missing/misshapen fields at edit time, year files import directly into engine + tests with no parser layer, and a single `YearRules` type is the source of truth for shape. The repo is TS already (Collector ADR-004, Calculator runtime), so this matches the grain. JSON+Zod's "pure data" benefit is real but doesn't outweigh the loss of compile-time shape checking on a small fixed parameter set.
- **Centralized citations**: one ITA "המדריך למילוי הדוח השנתי" PDF typically backs most parameters for a year. Inlining a full citation on every value would triple file size and noise. The `cite: 'madrich-2024'` indirection costs nothing and the loader keeps it sound.
- **Sign-off gating, not "best effort"**: when the engine eventually computes filing recommendations, an unreviewed year silently producing wrong numbers is worse than refusing to compute. The gate makes "is this year safe to use?" a single boolean check.
- **Two-source rule**: brackets and the credit-point value are the highest-impact parameters; a typo or stale source on either makes every refund wrong. Two independent ITA publications agreeing rules out ~all single-source mistakes for negligible extra work.
- **Archive the PDFs in-repo**: ITA links rot, especially across reform announcements. Local archive + SHA256 makes provenance reproducible offline and tamper-evident.

## Alternatives considered

- **JSON files + Zod schema** — rejected. Adds a runtime dep and a parser layer; loses compile-time shape checking. The "language-agnostic data" benefit isn't load-bearing in a single-runtime service.
- **Per-value inline `Citation` objects** — rejected. Triples file size with the same citation repeated 15+ times per year.
- **One big `rules.ts` keyed by year** — rejected. A single 5,000-line file is harder to diff, review, and sign off per year.
- **URL-only citations (no archived PDFs)** — rejected. Link rot kills the audit trail. Storing PDFs in-repo is cheap and the only way to re-verify a year cold months later.
- **Validate at runtime only, no compile-time types** — rejected. Catches errors after the engine has already started; the type system catches them at edit time for free.
- **No sign-off gate; just trust whatever's there** — rejected. We need a hard boolean between "reviewed and safe" and "scaffold/draft." Soft trust on tax math is how wrong refunds happen.

## Consequences

- Easier: the engine has one place to read rules from; one type to import; one validation pass to trust. Tests use an in-memory fixture year via `Calculator/__fixtures__/fixture-year.ts` without touching real data.
- Easier: adding a new tax year is "fetch the annual guide → write the year file → sign off after the YoY diff." No infrastructure change.
- Harder: every year must be verified before the engine can use it. Year files start as unverified scaffolds (`makeScaffoldRules(year)` in `_scaffold.ts`); verifying means replacing the call with a literal `YearRules` object backed by archived PDFs. That's intentional friction.
- Tradeoff: ~few-MB of PDFs per year committed to the repo. Acceptable — provenance survives, and the repo stays single-user-local-machine in v1.
- Tradeoff: rule changes mid-year (e.g. a reform announced in May 2026 affecting tax year 2026) need an explicit ADR or note pinning which version of the year file is which. The `verification.notes` field is the parking spot.

## Related

- [Calculator ADR-001](ADR-001-second-check-verifier.md) — the verifier; rule-table values that are hard to read unambiguously off a PDF are checked with `verifyClaim` against the archived text.
- [Collector ADR-004](../../Collector/decisions/ADR-004-ts-flow-modules.md) — same TS-on-Node grain.
- [Repo ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — sign-off gating is in the same spirit: the most expensive mistakes need an explicit human OK.
- [Repo ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md) — the engine's output (per-year refund/owe + recommendation) lands in the journey ledger; the rule tables are upstream of that.
