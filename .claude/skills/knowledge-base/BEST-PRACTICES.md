# Knowledge-Base Skill — Best Practices

> For repo-level structural conventions (CLAUDE.md / ADR / skill layout), see [`../monorepo-mega-skill/SKILL.md`](../monorepo-mega-skill/SKILL.md). This file governs only domain-content rules inside the knowledge base.

Read this before adding, editing, splitting, or merging files in this folder. These rules are why the knowledge base stays useful as it grows. Break them and the skill rots.

---

## 1. Router stays short. Detail goes in sub-files.

`SKILL.md` is loaded into Claude's context **every time the skill matches**. Keep it small: a description, a topics table, and instructions on how to route. Never paste actual knowledge into `SKILL.md` itself.

**Why:** A 5,000-token router burns context on every match, even when only one sub-topic is needed. A 200-token router that delegates to a 5,000-token sub-file only pays the cost when that sub-file is actually relevant.

---

## 2. The `description:` field is the trigger. Be concrete.

The `description:` is the **only** thing Claude sees when deciding whether to auto-invoke this skill. It must list specific trigger terms a user would actually type.

- ✅ Mention concrete forms: `טופס 135`, `1301`, `106`
- ✅ Mention domain phrases in **both Hebrew and English**: "החזר מס" *and* "tax refund"
- ✅ Include verbs/intents: "how do I file…", "am I eligible for…"
- ❌ Don't write vague descriptions like "Tax knowledge for RobinTax" — they fire on everything or nothing.

**Test it:** in a fresh session, ask the kind of question the skill should handle. If it doesn't auto-fire, the description is the problem 90% of the time. Update it, don't blame Claude.

---

## 3. One topic per file. Split before files exceed ~300 lines.

Each `.md` file in this folder covers **one** coherent topic. When a file grows beyond ~300 lines or starts to cover two distinguishable sub-topics, split it. Example: `tax-refund.md` becomes `tax-refund-salaried.md` + `tax-refund-self-employed.md` once each side has enough to stand alone.

**Why:** Smaller files = Claude reads less per query = faster, cheaper, more focused answers. Big files also become harder for *humans* to maintain.

---

## 4. Every fact-doc has a `Source:` and `Last verified:` line.

Tax law changes. A fact that was true in 2024 may not be true in 2026. Every topic file starts with:

```markdown
---
Source: <URL or law citation>
Last verified: YYYY-MM-DD
---
```

When you cite this file in an answer, include the `Last verified` date. If it's more than ~12 months old for tax content, flag it as "may be stale — re-verify" instead of asserting it.

**Why:** Confident-sounding wrong tax advice damages user trust and could be a real-world problem for RobinTax customers.

---

## 5. Don't duplicate `PRD.md` or code.

If a fact already lives in `PRD.md` (product decisions) or in code (calculation logic), **link to it** — don't copy. Two copies will drift; the knowledge base copy will silently become wrong.

```markdown
> The product scope decision on this is in [PRD.md](../../../PRD.md) #4.
```

**Why:** Single source of truth. The `prd-guard` skill enforces PRD.md as the authority on product decisions; this skill should respect that boundary.

---

## 6. Markdown that grep can read.

Topic files should be plain markdown with clear `##` headings. No fancy HTML, no big tables that wrap. This lets Claude `Grep` for a term inside the folder and jump straight to the right section without reading whole files.

- ✅ Section heading per concept: `## Form 135 — eligibility`
- ✅ Bullet lists for enumerable things (required documents, common refund triggers)
- ❌ Walls of prose where the reader has to read three paragraphs to find one fact

---

## 7. When the router doesn't know, **say so**.

If the user asks something the topics table doesn't cover, the answer is **not** "let me guess from training data." The answer is:

> "The knowledge base doesn't have a file on X yet. I can answer from general knowledge with the caveat that it isn't verified against an Israeli source — or you can give me a source and I'll add it as a topic file."

**Why:** The whole point of this skill is to be a *trusted* layer above generic LLM knowledge. Quietly falling back to training data destroys that.

---

## 8. Keep the topics table in `SKILL.md` in sync.

Adding a file without adding a topic-table row = invisible knowledge. Removing a file without removing the row = broken link. Whenever you touch the file list, touch the table.

---

## 9. Update the `description:` when you add a topic.

A new topic with new trigger terms means the router's `description:` needs those terms too — otherwise the skill won't auto-fire on questions about that topic. This is the most commonly forgotten step. Don't forget it.

---

## 10. Append-friendly, never destructive without a note.

If a tax rule changes (e.g., a credit-point amount updates, a deadline moves):
- Don't silently overwrite. Add the new value with the new `Last verified:` date, and keep a one-line note like `> Was 2,820 ₪ until 2025; raised to X in 2026.` if the prior value matters historically.
- Outdated facts that no longer matter at all *can* be deleted — use judgment.

**Why:** Users sometimes ask retroactive questions ("what was the rate in 2023?"). A knowledge base with no history can't answer them.

---

## 11. Hebrew-first content, English file names.

The user-facing knowledge in topic files is mostly Hebrew (or bilingual) because that's the domain. But **file names stay English kebab-case** (`tax-refund-salaried.md`, not `החזר-מס-שכירים.md`) because file paths show up in tool output, in `cd` commands, in URLs, and in editor tabs — and non-ASCII paths cause friction in all of those.

---

## 12. Don't mix functional behavior into this skill.

This skill is **knowledge** (Claude reads files and reports facts). If you need a *workflow* (Claude takes actions, runs commands, edits things), make a separate skill in `.claude/skills/<workflow-name>/` — like the existing `prd-guard`. Don't conflate the two; the `allowed-tools` and the writing style differ.

---

## When to revisit these rules

These rules are written for the current shape of the knowledge base (small, growing, single-domain). If the base ever needs sub-folders, multiple sub-routers, or cross-references to external systems, revisit and amend — but write down the new rule here so it persists.
