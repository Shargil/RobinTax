---
name: calc-tests
description: Run a verification test against the Calculator's rule tables, engine, or both. Dispatches to a specific test procedure under `tests/<test-name>.md`. Invoke when the user asks to "test the rules", "verify the calculator", "run a quiz", or names a specific test. Use proactively before flipping `verification.sign_off` on any year file.
---

# calc-tests — verification tests for Calculator/rules + engine

A small dispatcher. Pick a test from the list below, follow its procedure file, file the resulting artifacts under `Calculator/Tests/<test-type>/<dd.mm.yyyy> <test-type>/`.

## When to use

- User says "run a test", "verify the calculator", "test the rules", "quiz the calculator", or names one of the tests below.
- Proactively before flipping `verification.sign_off` to `'verified'` on a year file.
- After any structural change to `Calculator/rules/` or `Calculator/engine/`.

## Available tests

| Test | Procedure | What it catches |
|---|---|---|
| **30-question quiz** | [`tests/30-question-quiz.md`](tests/30-question-quiz.md) | Wrong NIS values, missing triggers, engine formula bugs, single-rate-vs-multi-rate oversimplifications. Runs by answering the same 30 questions twice — once from project's internal sources, once from public web — then comparing. |

(More tests will be added here as siblings under `tests/`.)

## Rules

- **Always run two independent passes** for any quiz-style test. The whole point is the cross-check between an internal-knowledge pass and an external-knowledge pass. A single-pass run is not a test.
- **Don't peek.** When doing the internet pass, do not consult the internal answers file (and vice versa). The verifier rule from ADR-001 (blind cross-check) applies here at the human-verification layer too.
- **Classify every discrepancy** — 🔴 BLOCKER / 🟡 WARNING / 🔵 INFO — and write it into `test-results.md`. Don't silently resolve.
- **Deep-investigate BLOCKERs** with multiple authoritative sources before claiming a fix. "Maybe right" is not good enough for tax math.
- **Archive every run** under `Calculator/Tests/<test-type>/<dd.mm.yyyy> <test-type>/`. Include a small `README.md` in the dated folder summarizing the run.

## Anti-patterns

- Don't run only the internal pass and call it a test (the cross-check IS the test).
- Don't fix a discrepancy by editing only the answer file — fix the underlying rule/engine, then re-run.
- Don't flip `verification.sign_off` on a year file while any 🔴 BLOCKER remains open.
- Don't archive a run that lacks `test-results.md` — without it the run can't be audited.

## Related

- [`tests/30-question-quiz.md`](tests/30-question-quiz.md) — the only test today.
- [`Calculator/decisions/ADR-002`](../../../decisions/ADR-002-year-versioned-rule-tables.md) — sign-off gating that this skill feeds into.
- [`Calculator/decisions/ADR-001`](../../../decisions/ADR-001-second-check-verifier.md) — same blind-cross-check philosophy at the value-extraction layer.
- [`Calculator/Tests/30 Questions/05.06.2026 30 q test/`](../../../Tests/30%20Questions/05.06.2026%2030%20q%20test/) — the first archived run (reference).
