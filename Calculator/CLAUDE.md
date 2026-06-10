# Calculator

Per-year tax-refund computation for RobinTax. For each finished tax year, given the docs the Collector has gathered, compute the refund (or owe) and recommend **file / don't-file / mandatory-file** — never silently committing to a number.

## Architecture (one rule)

**Deterministic math, LLM only at the edges, ITA as the final oracle.**

- Extraction (LLM): pull structured facts off 106s, BTL, donation receipts.
- Eligibility (LLM): judge soldier points, יישוב מזכה, immigrant, degree, etc., from cited year-versioned rules.
- The math (deterministic code): brackets, credit-point value, ceilings, refund subtraction — pure functions over year-versioned rule tables.
- Verify (deterministic): every load-bearing value is second-checked; every bottom line is human-confirmed.
- Before filing: predict-then-verify against ITA's own simulator (later phase). Must match before commit.

The service ships in layers: **verifier** (built, see [`verifier/`](verifier/)) → **rule tables + engine skeleton** (built, see [`rules/`](rules/) + [`engine/`](engine/), populating real values per year is a follow-up) → predict-then-verify against the ITA simulator (later phase).

## Boundaries

- Reads doc *paths* from the journey ledger ([Repo ADR-011](../docs/decisions/ADR-011-user-journey-ledger.md)); never owns or proxies credentials ([Repo ADR-001](../docs/decisions/ADR-001-no-credential-proxy.md)).
- Writes the per-year refund/owe figure + the **file / don't-file** recommendation back to the journey ledger.
- Filing itself is the scariest action ([Repo ADR-010](../docs/decisions/ADR-010-explain-and-gate-scary-actions.md)); the verifier's Mode B is the gate.
- No PII or credentials in the journey ledger or anywhere in this service.

## Stack

- TypeScript / Node ≥ 22.6, run via `--experimental-strip-types`.
- Zero runtime deps. Tests via the built-in `node --test`.
- Model calls shell to `claude -p --model <m>` — uses existing Claude Code auth, no API key.

## Available skills for this service

- `calc-refund` (repo-wide skill) — worker for the **Calculate refund** stage; invokes the verifier per the trigger policy.
- `calc-tests` (service-local skill, `Calculator/.claude/skills/calc-tests/`) — run verification tests against the rule tables + engine. Currently: the 30-question quiz. Use proactively before flipping `verification.sign_off` on a year file.

## Local decisions

- [ADR-001](decisions/ADR-001-second-check-verifier.md) — second-check verifier: deterministic verdict, blind + different-model cross-check, always-confirm bottom lines.
- [ADR-002](decisions/ADR-002-year-versioned-rule-tables.md) — year-versioned rule tables: typed TS modules, centralized citations, two-source rule on brackets/point-value, sign-off gating.

## Layout

- [`verifier/`](verifier/) — Mode A blind cross-check + Mode B render. See ADR-001.
- [`rules/`](rules/) — `types.ts` (shared `YearRules`), `load.ts` (validate + sign-off gate), `<YYYY>.ts` (one per tax year), `settlements/<YYYY>.ts`, `sources/<YYYY>/` (archived ITA PDFs), `yoy-diff.ts` (CLI). See ADR-002.
- [`engine/`](engine/) — `calculate.ts`: pure deterministic pipeline against `YearRules`. Helpers (`applyBrackets`, `soldierPoints`, `settlementDiscount`, `donationCredit`, `separateRateTax`, `mandatoryFilingTriggers`) are independently exported + tested.
- [`__fixtures__/`](__fixtures__/) — synthetic fixture year (tax_year 9999) used by `load.test.ts` + `calculate.test.ts`. NOT real ITA data.

## Repo decisions this service must honor

- [Repo ADR-001](../docs/decisions/ADR-001-no-credential-proxy.md) — no credential proxy.
- [Repo ADR-010](../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — explain + gate scary actions (filing is the scariest).
- [Repo ADR-011](../docs/decisions/ADR-011-user-journey-ledger.md) — read ledger at run start, update at run end.
