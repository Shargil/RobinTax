---
name: knowledge-base
description: RobinTax domain-knowledge router. Use whenever the user asks about Israeli tax topics relevant to RobinTax — tax refund process (החזר מס / tax refund) for salaried (שכיר / employee) or self-employed (עצמאי / self-employed / freelancer) people, forms (טופס 135 / 1301 / 106 / 1320 / 101 / 867 / 161 / 116א / 169א / 119 / 4435), required documents ("which documents do I need" / "אילו מסמכים" / "מאיפה משיגים"), eligibility, lookback window (6 years / שש שנים לאחור), refund timing & interest (4% / הצמדה), credit points (נקודות זיכוי), donations (תרומות / סעיף 46), new immigrant (עולה חדש / תעודת עולה), returning resident (תושב חוזר), discharged soldier (תעודת שחרור), periphery settlement (יישוב מזכה / סעיף 11), disability (סעיף 9(5)), deductions, recognized expenses (הוצאות מוכרות), מע״מ, ביטוח לאומי, מס הכנסה, deadlines, ITA (רשות המסים) procedures, or any factual "how does Israeli tax work / how do I claim a refund / am I eligible" question. Routes to the right reference file; do NOT answer from training data when this skill matches.
allowed-tools: Read, Grep, Glob
---

# RobinTax Knowledge Base — Router

This skill is an **index**, not a knowledge dump. The actual knowledge lives in sibling `.md` files in this folder. Your job when this skill fires:

1. **Look at the topics table below.** Identify which file(s) cover the user's question.
2. **`Read` only those files.** Do not read everything — the point of the router is that you load only what's relevant.
3. **If no topic matches**, say so explicitly ("the knowledge base doesn't have a file on X yet") and offer to create one using `_template.md`. Do **not** fall back to training data without flagging that you're doing so.
4. **Cite the source line** from the file you used (`Source:` / `Last verified:` at the top of each topic file).

## Topics

| Topic | File | Covers |
|---|---|---|
| Tax refund — salaried (שכיר) | [tax-refund-salaried.md](tax-refund-salaried.md) | Form 135 flow, eligibility, required docs (106 + supporting), 6-year lookback, common refund triggers (credit points, multi-employer, pension, donations) |
| Required documents catalog — salaried (שכיר) | [tax-refund-documents-salaried.md](tax-refund-documents-salaried.md) | Exhaustive catalog of every document that can affect a שכיר refund — what each is, identification question, where to obtain. Covers 106, 867, 161, 116א, 169א, 119, 4435, 4440, 127; donations (סעיף 46), IDF discharge, immigrant cert, periphery residency, etc. |
| Tax refund — self-employed (עצמאי) | [tax-refund-self-employed.md](tax-refund-self-employed.md) | Form 1301 + 1320 annual return, deadlines (30 Apr / 31 May), advance payments, recognized expenses, how the refund falls out of the assessment |
| Refund processing time & interest | [tax-refund-timing.md](tax-refund-timing.md) | How long refunds take (90–180 business days; statutory ceiling), CPI linkage + 4% interest (starts year 3), typical refund amounts, debt offset |

> When you add a new topic file, also add a row here. Keep one topic per file.

## How to add a new topic

1. Copy `_template.md` to `<topic-slug>.md` (kebab-case, English).
2. Fill in the `Source:`, `Last verified:`, and body.
3. Add a row to the Topics table above.
4. Update this skill's `description:` field to mention the new topic's trigger terms (Hebrew + English) so auto-trigger fires on it.

## Maintenance rules

See [`BEST-PRACTICES.md`](BEST-PRACTICES.md) — read it before editing this skill or any topic file. Those rules exist so the knowledge base stays useful as it grows.
