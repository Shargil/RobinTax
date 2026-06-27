---
name: knowledge-quiz
description: Personal study tool — generate an adaptive Hebrew quiz ("מבחני ידע") on Israeli salaried tax-refund knowledge, grade it with full worked explanations, log the answers, and track weak topics with spaced repetition + adaptive difficulty. Use when the user invokes `/knowledge-quiz [N]`, or asks "תן לי מבחן", "מבחן ידע", "quiz me on tax", or otherwise wants to study/test his tax knowledge. Dev/personal — NOT shipped in the plugin.
---

# knowledge-quiz — adaptive tax-knowledge exam (מבחני ידע)

A personal study tool for learning Israeli **salaried** tax-refund knowledge. The user asks for a number of questions; this skill writes a real exam (open-answer first), the user submits all answers at once, then it grades each question with a full worked calculation — like the מס יסף example in [`topics.md`](topics.md). Every run adapts: weak topics resurface via spaced repetition, and difficulty grows or shrinks with the user's score.

## Goal

Generate an adaptive Hebrew quiz, grade it with explanations + calculations, log the user's answers, and track mastery so the next quiz targets what he's weak on at the right difficulty.

## When to use

- `/knowledge-quiz [N]` (N = number of questions; default 10).
- "תן לי מבחן", "מבחן ידע", "quiz me on tax", "תבחן אותי".

## State files (all inside this skill folder)

- [`topics.md`](topics.md) — the topic taxonomy (75% basic / 25% advanced), the difficulty ladder (levels 1–5), and reference figures. **Read-only** reference.
- `progress.md` — living state: current difficulty `level` + the spaced-repetition table + score history. **Read at start, rewrite at end.** Create it (level 1, empty table) if missing.
- `attempts/<YYYY-MM-DD>-<nn>.md` — one file per attempt: the graded answer log. **Write at the end of every run.**

All paths are relative to this skill folder (`${CLAUDE_PLUGIN_ROOT:-.}/.claude/skills/knowledge-quiz/` when developing).

## Workflow

### 1. READ STATE

1. Read `progress.md`. Pull `level` (1–5, default 1) and the spaced-repetition (SR) table. If the file is missing, create it from the template in [`topics.md § progress.md template`](topics.md) with `level: 1` and an empty SR table.
2. Read [`topics.md`](topics.md) for the taxonomy, difficulty ladder, and reference figures.
3. Resolve `N`: the user's argument if given, else **10**. (One short line is fine: "10 שאלות, רמה X — יוצאים לדרך.")

### 2. BUILD THE QUIZ

- **Mix:** `basic = round(N × 0.75)`, `advanced = N − basic`. Guarantee **≥1 advanced** whenever `N ≥ 4`.
- **Topic selection** (in priority order, fill until you have `basic`/`advanced` slots each):
  1. **SR-due weak topics** — rows where `due_in ≤ 0`, `last_result: wrong` first, then `partial`. These MUST appear if due.
  2. New / rotating topics from the taxonomy not seen recently, at the current level.
  - Never repeat the same topic twice in one quiz.
- **Difficulty = current `level`.** Build every question to that rung of the [`topics.md`](topics.md) ladder. Level 1 is intentionally easy — single-concept recall, round numbers, one step — so reaching 90 is achievable.
- **Author like a professional exam writer.** Realistic numbers, a clean unambiguous stem, no trick wording. Most questions **open-answer** (numeric or one short sentence); multiple-choice is allowed only for pure-recall basics. Each question carries exactly one topic slug.
- For each question, prepare in your working memory (do NOT show yet): the correct answer, the full worked calculation, and the source figure used (year-stamped).

### 3. PRESENT

Output **one Hebrew message**: a header line (`מבחן ידע — רמה {level} · {basic} בסיס + {advanced} מתקדם`), then the questions as a numbered list. Tell the user to answer all of them and submit together (e.g. `1. ... 2. ...`). **Reveal nothing.** Then stop and wait — no tool calls, no answer key on screen.

### 4. GRADE

When the user submits answers:

- Grade each question: **✅ correct / ➗ partial / ❌ wrong.** Partial = right method, arithmetic slip → half credit. For open answers, grade on meaning, not wording; accept reasonable rounding.
- **Score** = `round(Σ points / N × 100)`, where correct = 1, partial = 0.5, wrong = 0.
- For each question render: the mark, the user's answer, the correct answer, and a **full explanation + worked calculation** in the style of the מס יסף example in [`topics.md`](topics.md), naming the source figure/year. Add the reference link where [`topics.md`](topics.md) has one.
- End with the **total score** (`ציון: 84`).

### 5. UPDATE SR + DIFFICULTY

For each topic tested, update its SR row (Leitner-by-topic; intervals in [`topics.md`](topics.md)):
- **wrong** → `box: 1`, `due_in: 0` (resurfaces next quiz).
- **partial** → `box` unchanged, `due_in: 0` (resurfaces next quiz).
- **right** → `box: min(box+1, 5)`, `due_in: interval[new box]`.
- New topics start at `box: 0` then apply the result.
- Decrement `due_in` by 1 for every topic **not** tested this quiz.

Then adjust difficulty from the score:
- `score > 90` → `level = min(level+1, 5)` (harder next time).
- `score ≤ 60` → `level = max(level−1, 1)` (easier next time).
- otherwise → `level` unchanged.

Append a `History` row (`date | level-just-played | score`), then **rewrite `progress.md`** with the new `level`, updated SR table, and stamp `Last updated`.

### 6. LOG THE ATTEMPT

Write `attempts/<YYYY-MM-DD>-<nn>.md` (`nn` = next sequence number for that date, zero-padded). See the format in [`topics.md § attempt-file template`](topics.md). It records: date, level played, score, every question with `{topic, stem, user answer, correct answer, result}`, the resulting SR changes, and the next-quiz difficulty. Close with one Hebrew line telling the user where it's saved and which topics will resurface next time.

## Rules

- **Hebrew throughout.** Questions, explanations, and the wrap-up are in Hebrew. Use [[feedback_no_btl_acronym]] naming — `רשות המיסים`, never `ITA`.
- **Salaried focus.** Stay on salaried-employee refund knowledge (75% basics). The 25% advanced bucket is where מס יסף / capital income / edge cases live — don't let advanced creep past ~25%.
- **One topic per question, always logged.** Grading and SR depend on it.
- **Never reveal answers before submission.** §3 presents; §4 grades. No leaking in between.
- **State is the source of truth.** Read `progress.md` at the start of every run and rewrite it at the end — difficulty and weak-topic memory persist only through that file.
- **Year-stamp every figure.** Tax thresholds change yearly; show the year of any number used (default to the latest year in [`topics.md`](topics.md), currently 2025) so a wrong-because-stale figure is auditable.
- **Adaptive, not punishing.** Start easy. Only climb when the user clears 90; drop the moment he's at/under 60.

## Anti-patterns

- Hard-coding a fixed question list. Questions are generated per run from the taxonomy + level + SR due-list.
- Ignoring the SR table — asking fresh topics while due weak topics go unreviewed.
- Jumping difficulty by more than one level per quiz.
- Grading open answers on exact wording instead of meaning.
- Forgetting to rewrite `progress.md` or to write the attempt log (the whole point is the longitudinal record).
- Letting advanced questions exceed ~25% of the quiz.

## Related files

- [`topics.md`](topics.md) — taxonomy, difficulty ladder, reference figures, file templates.
- `progress.md` — living difficulty + SR state (created on first run).
- `attempts/` — graded answer logs.
