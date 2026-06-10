# 30-question quiz — procedure

Verify a scoped slice of `Calculator/rules/` by answering 30 questions twice in parallel (internal vs internet) and reconciling.

## Inputs

- **Scope**: e.g. "salaried tax for 2024 + 2025" or "self-employed pension for 2025". User-specified.
- **Today's date** in `dd.mm.yyyy` form for the archive folder.

## File-name convention

- Questions: `<scope-slug>.md`
- Internal answers: `<scope-slug>-answers.md`
- Internet answers: `<scope-slug>-answers-internet.md`
- Results: `test-results.md`

All four go under `Calculator/Tests/<test-type>/<dd.mm.yyyy> <test-type>/` along with a `README.md`.

## Procedure

1. **Pick scope.** Confirm with the user: which rule area + which tax year(s).

2. **Write 30 questions** covering the full surface area of the scope — brackets, credit-point value, status credits (soldier / immigrant / settlement / etc.), donations §46, pension §47/§45A, surtax, mandatory filing, plus any scope-specific edge cases. Each question specifies its tax year(s). Save as `<scope-slug>.md`.
   - **Acceptance**: every answer is derivable from a primary source (ITA PDF or regulation). No opinion questions.

3. **Internal-only pass.** Answer all 30 from project sources only — populated `rules/*.ts` + archived ITA PDFs in `Calculator/rules/sources/`. Cite `<file>:<line>` per answer. Save as `<scope-slug>-answers.md`.
   - **Acceptance**: every citation resolves to a real file/line. No prior-knowledge answers.

4. **Internet-only pass.** Answer the same 30 from public web sources only (gov.il, Kolzchut, accountant blogs). Cite URLs. **Do not read the internal-answers file.**  Save as `<scope-slug>-answers-internet.md`.
   - **Acceptance**: no project files consulted; every citation is a URL.

5. **Side-by-side compare** each of the 30 answers. Per question, tag: ✓ aligned · ⚠️ minor gap (no contradiction) · 🚨 discrepancy.

6. **Classify severity** for each 🚨 — 🔴 BLOCKER · 🟡 WARNING · 🔵 INFO. Write the comparison table + classifications into `test-results.md`.

7. **Deep-investigate each BLOCKER** with multiple authoritative web sources (regulation text, ITA circulars, accountant deep-dives) until the correct value is unambiguous. Document each finding + a concrete fix spec under that blocker's row in `test-results.md`.

8. **(Optional, on user approval) Apply fixes.** Update `types.ts`, year files, fixture-year, scaffold, load-validator, engine, and tests. Run `npm test` and `npx tsc --noEmit` until green. Mark fixed items ✅ in `test-results.md`.

9. **Re-run `yoy-diff`** between the relevant years. Confirm expected invariants still hold (e.g. indexation freeze → near-zero value diff for 2024 → 2025).

10. **Archive.** Move all four files into `Calculator/Tests/30 Questions/<dd.mm.yyyy> 30 q test/` and add a `README.md` summarizing scope + headline outcome. Rewrite any relative links from `(2024.ts)`-style to `(../../../rules/2024.ts)` to keep them resolvable from the new depth.

## Anti-patterns

- Internet pass that quietly cross-references the internal pass — defeats the test.
- Marking a 🚨 ✅ resolved before fixing the underlying rule/engine.
- Skipping step 7 ("deep investigate") and applying a "best-guess" fix.
- Forgetting to update the relative links during archival (step 10).

## Related

- First archived run: [`Calculator/Tests/30 Questions/05.06.2026 30 q test/`](../../../../Tests/30%20Questions/05.06.2026%2030%20q%20test/).
