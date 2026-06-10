# 30-question quiz — 2026-06-05 run

Verification of `Calculator/rules/2024.ts` and `2025.ts` against a 30-question quiz on Israeli salaried tax law, answered twice in parallel (internal + internet) and consolidated.

| File | Purpose |
|---|---|
| [`salaried-tax-quiz-2024-2025.md`](salaried-tax-quiz-2024-2025.md) | The 30 questions |
| [`salaried-tax-quiz-2024-2025-answers.md`](salaried-tax-quiz-2024-2025-answers.md) | Internal-knowledge answers (this repo's rule files + archived ITA PDFs only) |
| [`salaried-tax-quiz-2024-2025-answers-internet.md`](salaried-tax-quiz-2024-2025-answers-internet.md) | Internet-only answers (public web sources only) |
| [`test-results.md`](test-results.md) | Side-by-side audit + every issue flagged, with status (BLOCKER / WARNING / INFO / RESOLVED) |

## Final outcome

After this run: all 3 blockers (B1 soldier formula, B2 mandatory-filing thresholds, B3 §45A rate split) were fixed in the engine + rule files, both year files were flipped to `sign_off: 'verified'`, and the test suite ran 84/84 green.

Future runs should sit in a sibling folder named `dd.mm.yyyy 30 q test`.
