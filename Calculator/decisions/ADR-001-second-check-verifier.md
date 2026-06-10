# ADR-001: Second-check verifier — deterministic verdict, blind cross-check, always-confirm bottom lines

**Date:** 2026-05-30
**Status:** accepted

## Context

The Calculator's correctness rests on values that are partly LLM-extracted (numbers off Form 106 / BTL PDFs) and partly LLM-judged (eligibility for credits like discharged-soldier points and יישוב מזכה). LLMs are unreliable at multi-step arithmetic and at applying conditional rules consistently — the two things tax calculation requires most. The Calculator needs a reusable reliability primitive that catches both *input* errors (a wrong number extracted) and *output* errors (a wrong bottom-line refund or a wrong file-or-not call), without trusting an LLM to police itself.

## Decision

A reusable **verifier** module with two modes, sharing a deterministic core.

- **Mode A — blind, different-model cross-check.** For each load-bearing value (each 106's withheld-tax and gross income, BTL totals, every eligibility judgment), the verifier independently re-derives the answer with a *different, smaller* model (`claude -p --model haiku|sonnet`; primary is opus). The verifier prompt is **blind** — it never sees the primary answer, so it cannot anchor to it. The compare-and-verdict step is **pure code** (typed tolerance: exact for `integer`/`credit_points`/`enum`, ±1 ₪ OR ±0.5% for `currency`) — never an LLM judging agreement. Verdict: `agree | disagree | uncertain`.
- **Mode B — always-confirm bottom lines.** Every year's final refund/owe figure and **file / don't-file** recommendation is rendered from the structured worksheet by deterministic code (no LLM paraphrase drift), shown to the user with provenance, and gated on explicit y/n. Also auto-triggered whenever Mode A returns `disagree` or `uncertain`.
- **Trigger policy** lives in the `calc-refund` skill (not in code): Mode A on every load-bearing value — silent unless it disagrees, so it respects "don't nag"; Mode B on every bottom line, always.
- **Testability seam:** `verifyClaim(claim, modelRunner, model)` takes an injected runner. The default `claude -p` subprocess is isolated in `runner.ts`; tests pass a stub, so the suite is offline and deterministic.

## Why

- **LLMs don't police LLMs.** The single most important property is that the *verdict* (agree/disagree) is deterministic code, not another model call. Otherwise a sycophantic verifier would rubber-stamp the primary's errors.
- **Blindness defeats anchoring.** If the verifier sees the primary answer, it tends to agree. A blind verifier gives an independent signal.
- **Different model family decorrelates errors.** Same-model dual extraction tends to make the same mistake twice. A different size/family produces independent failure modes.
- **Filing is irreversible.** Once an Israeli annual return is filed, an assessment is created. The cost of a wrong bottom line dwarfs the cost of one y/n prompt, so bottom-line confirmation is unconditional. This is also how Mode B implements [Repo ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) for the filing decision.
- **`claude -p` over an API key.** Uses existing Claude Code auth — no key to manage or rotate, model access already enforced by Claude Code. The verifier still behaves as code (subprocess + structured stdout); the model is just a swappable flag.

## Alternatives considered

- **Single model, dual prompt** — rejected as Mode A's primary mechanism. Errors stay correlated; weaker independence. Acceptable as a degraded fallback if model availability is constrained.
- **LLM-as-judge verdict** (model decides "do these agree?") — rejected. Reintroduces the exact failure mode we're trying to avoid: a model rubber-stamping its own kind. The verdict must be code.
- **Anthropic SDK + `ANTHROPIC_API_KEY`** — rejected for v1. Adds a dependency and a secret to manage with no behavioral benefit over `claude -p` in this single-user-on-their-own-machine v1.
- **Native Claude subagent (`Agent` tool with model override)** — rejected as the primary mechanism. It's "Claude chooses to verify" rather than a reproducible code component; can't be unit-tested or invoked outside a Claude session.
- **Always human-confirm everything** (skip Mode A) — rejected. Violates "don't nag" (memory `feedback_approval_frequency`); makes the user the only line of defense on dozens of intermediate numbers. Mode A is silent on agreement and surfaces only the genuine forks.

## Consequences

- Easier: any future Calculator component (extractors, eligibility judges, the engine itself) gets a one-call reliability primitive. Tests stay offline via the injected runner.
- Easier: the filing gate is implemented by the same primitive that catches mid-pipeline mistakes — one mechanism, two payoffs.
- Harder: every caller must remember to wrap load-bearing values with `verifyClaim`. The `calc-refund` skill documents which values qualify and is the only intended caller in v1.
- Tradeoff: subprocess overhead — roughly one `claude -p` call per claim. Acceptable in v1; batchable later if it bites.
- Tradeoff: relying on the `claude` CLI's local auth means the verifier won't work in CI/headless environments without claude-code setup. Acceptable — Calculator runs in the user's local Claude Code session, same as Collector.

## Related

- Repo [ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md), [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md), [ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md).
- Collector [ADR-004](../../Collector/decisions/ADR-004-ts-flow-modules.md) — same TS-on-Node grain.
- [`.claude/skills/calc-refund/SKILL.md`](../../.claude/skills/calc-refund/SKILL.md) — the trigger policy that decides what counts as "load-bearing".
