---
name: canonicalize-rule
description: Dev-only — canonicalize one substantive tax rule (e.g. §39A soldier, §11 settlement, §35 immigrant) into a single source-of-truth at `tax-rule/<slug>.md`, fold in scattered prose from types docstring + engine comment, strip impl files to one-line pointers, register the rule in `Intake/checklist.md`, and wire up drift tests. Use when the user invokes `/canonicalize-rule <slug>` or says "canonicalize <section>". One rule per invocation; multi-rule batches should be separate chats.
---

# canonicalize-rule — one tax rule → one canonical spec + drift checks

For a single tax rule, produce `tax-rule/<slug>.md` as the canonical source of truth, fold in all scattered prose, strip impl files to pointers, tag tests by id, gap-pass against the primary external source, and wire up drift tests that fail when spec and code disagree.

## When to use

- User invokes `/robintax:canonicalize-rule <slug>` (e.g. `soldier-39a`, `settlement-11`, `immigrant-35`).
- Run **one rule per chat** — context budget + the gap-pass step is deep work.
- §39A soldier was the prototype; `tax-rule/soldier-39a.md` is the reference shape. Copy its structure.

## Pre-flight

- Confirm `tax-rule/<slug>.md` does NOT already exist. If it does → ask the user whether to refresh it (re-run the gap pass + verification log entry only) or abort.
- Confirm the rule's primary external source (usually kolzchut + ITA madrich). Ask the user for the URL if not obvious.

## Workflow

### 1. PICK
Confirm: section number (e.g. `39A`), slug (e.g. `soldier-39a`), Hebrew name, primary source URL. If any are unclear, ask before proceeding.

### 2. INVENTORY
Find every file touching this rule. Default loci:
- `Intake/checklist.md` — does the rule's slug already have a checklist line? If yes, note `tax-rule: <existing>`; if no, plan to add a line in §5.
- `Calculator/rules/types.ts` (the rule's interface — fold the docstring IN)
- `Calculator/rules/<YYYY>.ts` (per-year values — stay, map TO)
- `Calculator/engine/calculate.ts` (the math function — fold the comment IN)
- `Calculator/engine/calculate.test.ts` (worked-example tests — tag with `[id]`s)
- `Collector/documents/<slug>.md` (proof-doc playbook — stay, map TO)
- `Calculator/rules/sources/<YYYY>/*.pdf` (archived ITA PDFs — stay, cite by page)

Print the inventory list before continuing.

### 3. FETCH PRIMARY SOURCE
WebFetch the primary external source (usually kolzchut). Ask for "every fact and edge case" — be exhaustive in the prompt. Capture `fetched_date`.

Also capture the **kolzchut lede** — the short opening paragraph at the top of the page explaining who the rule is for and what they get. Lift it verbatim as raw material; you'll rewrite it in §4 into a plain-Hebrew `rule_lede`. Don't ship the kolzchut text as-is — it's usually too legalese.

### 4. DRAFT THE SPEC
Copy `tax-rule/SPEC-TEMPLATE.md` to `tax-rule/<slug>.md`. Fill every section. Fold in:
- Prose from the `types.ts` interface docstring (formula prose, edge-case notes).
- Prose from the engine function's worked-example comment.
- Worked examples from existing tests (each becomes a row with an `id`).
- The `## Intake` section: write it from scratch based on the rule's actual eligibility logic (gate already lives in `Intake/checklist.md` as the user-facing label; follow-ups are everything the engine needs to apply the rule beyond "is this on?"). Each follow-up names which engine input it sets and which doc resolves an `unknown` answer.

These sections are **required**, even if SPEC-TEMPLATE drifts:
- `## Per-year values` — table by year, every numeric the engine reads. This is the drift-test contract.
- `## Year-over-year changes` — one row per year that changed (value, threshold, eligibility, formula). Why it matters for intake (e.g. "asks differ pre/post 2024").
- `## Intake flow` — four keys:
  - `rule_lede`: a short plain-Hebrew blurb (1–3 sentences, ~30 words max) explaining who qualifies and what they get. The intake walker renders this as the **description of the first follow-up question** so the user knows what they're confirming before answering. Write it from the kolzchut lede (§3) but **rewrite for clarity** — don't ship legalese.
    - **Easy words only.** Imagine explaining to a friend who's never filed taxes. No "זכאות", "תקרה", "בכפוף ל-" if a simpler phrase works.
    - **Hebrew jargon in Hebrew.** No English transliteration. If you must use a tax term, it stays Hebrew.
    - **Main thing first.** Lead with who qualifies + what they get. Skip preamble like "על פי חוק...".
    - **Fold the key edge case in.** If a load-bearing condition would surprise the user (e.g. "must live there 12 consecutive months", "only first 3.5 years after aliyah", "discharged honorably only"), weave it into the lede — don't bury it in follow-ups.
    - **Examples beat definitions** when a category is fuzzy (e.g. "ירוחם, שדרות, מצפה רמון" rather than "יישוב מזכה").
    - **No numbers that change yearly.** Refer to "התקרה השנתית" or "הסכום שנקבע", not specific shekel amounts — the per-year values live in `## Per-year values` and would make the lede go stale.
  - `primary_question`: the single gating Q (e.g. "Did you serve in the IDF in <year>?"). One per rule.
  - `follow_ups`: only asked if primary = yes. Each follow-up names which engine input it sets. The first follow-up carries `rule_lede` as its description.
  - `unknown_fallback`: if user picks "I don't know" on a follow-up, which document does `/get-doc` fetch to resolve it? (e.g. "תעודת שחרור resolves service length"). Never gate on unknowns the docs can answer.

### 5. STRIP IMPL FILES TO POINTERS + REGISTER IN CHECKLIST
- `types.ts`: interface docstring → `/** Canonical spec: tax-rule/<slug>.md. */`
- `calculate.ts`: function docstring → `/** Canonical spec: tax-rule/<slug>.md. */`
- `Intake/checklist.md`: ensure a line for this slug exists under the appropriate group. If the line was a v2-stub (`tax-rule: none`), flip it to `tax-rule: <slug>`. If no line existed, add one with the Hebrew label and `tax-rule: <slug>`.

**Do NOT** strip year-rule values or the actual code logic. Only prose.

### 6. TAG TESTS
For each worked-example row in the spec, rename the matching `it(...)` in `calculate.test.ts` to include the `[id]` tag. Add new tests for any spec example that doesn't have one yet.

### 6.5 INTAKE + ENGINE SYNC
Reconcile spec's `## Intake` section and `## Per-year values` against live code:
- **Checklist registration** — confirm `Intake/checklist.md` has a line for this slug under the appropriate group, with `tax-rule: <slug>` (not `none`). The intake walker reads this file to render panels and route to specs.
- **Spec § Intake** — the gate is the checklist label (the checkbox); the spec owns the follow-ups. If follow-ups in the spec don't match what the engine needs as inputs, **patch the spec** so each follow-up names an engine input. Intake UX is product-surface prose — rewriting it here is in-scope.
- **Engine** — if the spec reveals a year-diff, threshold, or eligibility branch the engine doesn't implement, this is a **CONFLICT** (§10). Surface it, do NOT silently patch `calculate.ts` or year-rule values. The user decides whether the spec or the engine is right.

Rule of thumb: prose and intake UX = patch freely. Numbers, formulas, eligibility branches in code = conflict, surface only.

### 7. GAP-PASS LOOP
Re-read the primary source side-by-side with the draft spec. Build a gap list. Categories:

- **GAP** — fact exists in source, absent from spec. Additive; just add it.
- **CONFLICT** — fact in source DISAGREES with what spec or code says. **Stop and surface — do not silently fix.** See §10.

For each GAP: patch the spec.
For each CONFLICT: add to the conflict list (§10), DO NOT patch silently.

Iterate until the spec covers every fact in the source.

### 8. BUMP `last_verified` + LOG
In the frontmatter, bump `last_verified` to today (suffix `b`, `c`, ... if same-day). Add a `## Verification log` entry naming every gap closed and every conflict found.

### 9. WIRE DRIFT TESTS
Add a `describe` block to `tax-rule/drift.test.ts` for the new spec, modeled on the §39A block. Three checks per spec:
- **Year-values match TS** — extracted JSON block `==` `rules[<rule_key>].value` for each year.
- **Worked-example ids each have a `[id]` tag in the test file** named in the spec's impl-map.
- **Checklist registration** — `Intake/checklist.md` contains a line with `tax-rule: <slug>` for this spec. Catches drift where a spec exists but isn't reachable from intake.

Run `node --experimental-strip-types --test Calculator/engine/calculate.test.ts Calculator/rules/load.test.ts tax-rule/drift.test.ts`. All green or do not finish.

### 10. REPORT — TWO LISTS

End the session with **exactly these two lists, in this order**, even if empty:

```
## ✅ Gaps closed
- <gap>: <one line on what was added + where>
- ...

## 🚨 CONFLICTS FOUND (review required)
- <item> | OUR CODE/SPEC SAYS: <value> | SOURCE SAYS: <value> | IMPACT: <user-facing effect> | RECOMMENDED: <action>
- ...
```

The conflicts list is the most important output of this skill. Print it last so it doesn't scroll off. If there are zero conflicts, write `(none)` under the heading — never omit the section.

**A conflict is anything where our number, threshold, formula, eligibility rule, or doc requirement DISAGREES with the source — not where the source has something we simply don't mention.** Disagreement = we're potentially computing tax wrong. Mention = additive nice-to-have.

### 11. APPROVE INTAKE FLOW — final gate

After the report, render the spec's `## Intake` section as ASCII panels that mirror what the user sees in `AskUserQuestion` during `/intake`. The gate is the checklist line (one panel showing the Hebrew label as a multi-select option); each follow-up is one panel with its `{Category} {i}/{N}` prefix. Then ask: **approve, or tell me what to improve.**

Panel shape — keep proportions tight, Hebrew in parens after the English (per intake conventions), `I don't know` always last with the `unknown_fallback` doc named inline:

```
┌─ Checklist line (Intake/checklist.md) ──────────────┐
│ ☐ <Hebrew label as it appears in the checklist>     │
└─────────────────────────────────────────────────────┘
```

Then, for each follow-up (asked when the checklist line is checked). The **first follow-up panel includes `rule_lede` above the question** — Hebrew, verbatim from kolzchut, separated by a blank line. Subsequent follow-ups skip the lede:

First follow-up:

```
┌─ <Category> 1/K ────────────────────────────────────┐
│ <rule_lede line 1>                                  │
│ <rule_lede line 2>                                  │
│                                                     │
│ <follow-up question text>                           │
├─────────────────────────────────────────────────────┤
│  ○ <option 1>                                       │
│  ○ <option 2>                                       │
│  ○ I don't know                                     │
│    → we'll fetch <doc> (<doc in Hebrew>) to check   │
└─────────────────────────────────────────────────────┘
```

Subsequent follow-ups (no lede):

```
┌─ <Category> k/K ────────────────────────────────────┐
│ <follow-up question text>                           │
├─────────────────────────────────────────────────────┤
│  ○ <option 1>                                       │
│  ○ <option 2>                                       │
│  ○ I don't know                                     │
│    → we'll fetch <doc> (<doc in Hebrew>) to check   │
└─────────────────────────────────────────────────────┘
```

End the panels with one line: **"Approve, or tell me what to tweak (wording, options, order, fallback doc)."** Wait for the user's response before declaring the rule canonicalized. Any edits they ask for → patch the spec's `## Intake` section (and `Intake/checklist.md` if the label changes) in the same turn, then re-render the panels to confirm.

This step is intentionally after §10 REPORT — conflicts are the most important *content* output; this is the most important *UX* output. Both matter, both must be seen.

## Rules

- **Filename convention: `<topic>-<section>.md`** (topic first, section number(s) suffix). Examples: `soldier-39a.md`, `settlement-11.md`, `degree-40c-40d.md`, `multi-employer-121-164.md`, `bituach-leumi-benefits-9.md`. No `section-` prefix (the folder already says `tax-rule/`). Filename slug == frontmatter `slug:` == `Intake/checklist.md` `tax-rule:` value — no translation layer.
- **One rule per invocation.** Multi-rule batches lose precision in the gap pass.
- **Conflicts get their own list, ranked above gaps.** A buried conflict is a tax bug shipped to a user.
- **Never silently fix a conflict.** Surface it; the user decides whether the source or our code is correct.
- **Values, code, and tests are sacred.** This skill rewrites prose, not numbers. Touching a numeric value or the formula = conflict territory; surface, don't patch.
- **Drift tests are non-negotiable.** Don't finish without green tests.
- **Bottom-line confirmation.** Before reporting done, restate to the user: spec path, files stripped, test count change, conflict count.

## Anti-patterns

- Folding the collector playbook (`Collector/documents/...`) into the spec — different concern, stays separate.
- Folding ADRs into the spec — they're architectural, not rule content.
- Treating every source bullet as a gap — kolzchut sometimes has product-surface info (forms to file, who to call) that belongs in the product, not the rule spec. Filter for: law, eligibility, formula, edge cases, documents.
- Rewriting code from the source ("kolzchut says X, so I'll change `min_service_months_male_long` to X"). That's a conflict — flag it, don't touch the value.
- Running on a rule where the user hasn't agreed which external source is primary.

## Related

- [`tax-rule/SPEC-TEMPLATE.md`](../../tax-rule/SPEC-TEMPLATE.md) — the blank template this skill fills.
- [`tax-rule/soldier-39a.md`](../../tax-rule/soldier-39a.md) — reference spec; copy its shape.
- [`tax-rule/drift.test.ts`](../../tax-rule/drift.test.ts) — drift-test file; extend per rule.
- [`Calculator/CLAUDE.md`](../../Calculator/CLAUDE.md), [`Intake/CLAUDE.md`](../../Intake/CLAUDE.md) — service-level context.
