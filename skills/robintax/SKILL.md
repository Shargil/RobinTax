---
name: robintax
description: Front door for a user's tax-refund run. Use when the user invokes `/robintax` to resume — "where did I leave off", "continue my tax return", "run the next step". Reads the per-user journey ledger, reports standing across all stages (collect → calculate → file), and routes to the right worker skill (today: get-doc). Slash-command-style entry point; routes rather than re-implementing worker logic.
---

# robintax — resume the tax return and run the next step

The orchestrator / front door. It owns **reading** the journey ledger and **routing** to worker
skills. It does not fetch documents, calculate, or file itself — workers do that.

Three layers (see [ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md)):

- **State** — the ledger at `<memory>/journey.md` (`<memory>` = `~/.claude/projects/<project>/memory/`).
- **Orchestrator** — this skill.
- **Workers** — `get-doc` (collection, built); `calc-refund` (calculation, built — engine + 2020–2025 rule tables + verifier all in place); `file` (not built yet).

## Workflow

### 0. FIRST-RUN check (one-time, silent if already set up)

The very first `/robintax` (or `/robintax:robintax` when invoked via plugin install) in a fresh install:

1. `mkdir -p ~/Downloads/RobinTax` — idempotent. This is the collection folder; everything `get-doc` saves lands here.
2. Detect platform: `node -e "console.log(process.platform)"` (or `uname`). Record once in user memory (e.g. `~/.claude/projects/<scope>/memory/platform.md`) so we don't re-detect every run.
3. **Platform feature matrix** — surface ONCE on first run, then never again:
   - **macOS**: full features. Apple Reminders back the cohort/auto-recheck lifecycle. `split-screen.sh` arranges editor + browser.
   - **Windows / Linux**: degraded. No OS-level reminders (Apple Reminders is macOS-only; see Windows backend TODO at the bottom of this file). Auto-recheck only fires when the user manually runs `/robintax` and a cohort ETA has passed. No window splitting.

If platform-record exists, skip step 3.

### 1. READ

Read `<memory>/journey.md`. If it's missing or empty, say so and offer to start document collection
via `get-doc`.

### 1b. AUTO-RECHECK PENDING DOCS

Before reporting, scan `requested` rows. Group by `Reminder ID` (cohort). For each cohort:

- If `ETA <= today`, **or** (macOS only) the Apple Reminder has been manually completed by the user (osascript
  `tell application "Reminders" to return completed of (first reminder whose id is "<id>")` returns
  `true`), route to `/get-doc` RESUME mode for every doc in the cohort and let it run the re-check
  → resolve/re-stamp lifecycle (per [ADR-012](../../docs/decisions/ADR-012-apple-reminders-for-pending-docs.md)).
- On non-macOS, skip the "manually-completed reminder" branch — only the `ETA <= today` branch fires. The user must `/robintax` to trigger the recheck themselves.
- Do not gate this. Re-checking the user's own pending doc is not scary; the user has explicitly
  asked us not to nag (see [[feedback_approval_frequency]]).
- Announce in one line before delegating: `One reminder is due — re-checking 3 docs from the Sun 2026-06-14 cohort…`.

If no cohorts are due and none are manually-completed, skip and continue to REPORT.

### 2. REPORT

Use this exact shape — short, scannable, no tables, no link soup:

```
We have:
1. <Full doc name (Hebrew name)>
2. ...

We're missing:
1. <Full doc name (Hebrew name)> — <one-line status, e.g. "awaiting council email reply, 7 days since send">

Next step:
<one sentence>

Continue? [Y/n]
```

Formatting rules:

- **Blank line between sections** (`We have` / `We're missing` / `Next step` / `Continue?`). Never run them together.
- **Omit any section that's empty.** If nothing is missing, drop the `We're missing:` block entirely — don't render the header with "Nothing" under it.

Naming rules:

- **No abbreviations or slugs.** Write the full English name with the **Hebrew name in parentheses**. e.g. "Ramat HaNegev residency confirmation (אישור תושב — מועצה אזורית רמת הנגב)", not "RNG residency" or "residency-confirmation-section-11".
- **Hebrew is preferred** — the user reads tax jargon faster in Hebrew. Always include it.

Linking rules:

- **Do not link doc names to the `Collector/documents/<slug>.md` research files** — those are internal playbooks, not useful to the user.
- If a doc is `have`, you may link to the **actual file path** from the ledger's `File` column (e.g. `~/Downloads/RobinTax/...`). If the path is a glob or unclear, just don't link — bare text is fine.
- Skip links for `requested` / `blocked` / `todo` rows.

### 3. PICK NEXT

Walk stages top-down; act on the first one that isn't `done`.

- **Collect documents** (the only implemented stage) → hand to `get-doc`:
  - **`requested` docs** — offer to re-check each one's **real delivery channel as defined in that
    doc's playbook** (`Collector/documents/<slug>.md`). Do **not** assume email. e.g. the IDF cert
    lives on the portal — re-open `ishurim.prat.idf.il` and read the (830) card badge
    (`הופק בהצלחה` → download; `ממתין להפקה` → still pending, poll). Delegate the actual fetch to `get-doc`.
  - **`blocked` docs** — surface the manual next step (e.g. RNG section-11 → email `ilant@rng.org.il`).
  - **`todo` docs** — propose the next one; on go-ahead, hand off to `/get-doc <slug>`.
  - The collection-stage "what's next / re-check pending" logic already lives in `get-doc`'s no-arg
    RESUME mode — invoke it rather than re-implementing.
- **Calculate refund** → hand to `calc-refund` once enough docs are `have` to compute at least one
  year. Engine, 2020–2025 rule tables, and verifier are all built. Do **not** invoke `calc-refund`
  while the collect stage has no computable year.
- **File return** — not built yet. Report `not-started` as a placeholder. Do not invent behavior.

### 4. GATE

Per [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md): report and propose
the next action first; only enter browser / worker actions after the user says go. State the one-line
reason before each scary action.

### 5. WRAP-UP (end of session)

**Trigger:** auto-fires whenever control is about to return to the user with **at least one required
doc still in `requested` or `todo`**. The partial-collection state is itself the "session over"
signal — no explicit "I'm done" needed. If everything is `have` and collect is complete, skip wrap-up
and route to `/calc-refund` instead.

**Why this exists:** so the user closes Claude with a clear picture of what's pending, when their Mac
will ping them, and — critically — which tax years they can push to `/calc-refund` *right now*
instead of waiting on the slow docs (per the partial-unblock rule below).

**Format** — use this exact shape. Hide any section that's empty.

```
Wrap-up
=======

We got today:
  ✓ <Full name (Hebrew name)> → <file path>

Still pending (cohort reminders set):
  ⏳ Sun 2026-06-14 10:00 — 3 docs:
       • <Full name (Hebrew name)>
       • <Full name (Hebrew name)>
       • <Full name (Hebrew name)>
  ⏳ Tue 2026-06-16 10:00 — 1 doc:
       • <Full name (Hebrew name)>

Years ready to push to /calc-refund NOW (partial wins):
  ▶ 2022 — all required docs in hand. Run /calc-refund 2022.
  ▶ 2024 — all required docs in hand. Run /calc-refund 2024.

Years still blocked:
  ⏸ 2023 — waiting on <Full name (Hebrew name)>
  ⏸ 2025 — waiting on <Full name>, <Full name>

What to do next:
  • Push the ready years through /calc-refund now — don't sit on a refund you can already claim.
  • Your Mac will ping you on <earliest ETA> for the rest. When it fires (or any arrive sooner),
    run /robintax — I'll re-check them first thing.
```

**Rules:**
- Group pending docs by cohort (shared `Reminder ID` / shared `ETA`), one block per due-date — this
  matches the single reminder the user will actually see, not N separate ones.
- Full English names with **Hebrew in parens** — same naming rules as §2 REPORT.
- If the "Years ready to push" section is non-empty, that bullet is the **first** "what to do next"
  item. Never let the user idle when they could already be claiming a refund for a complete year.
- If nothing is pending, skip wrap-up entirely and route to the next stage.

**Per-year completeness gate — PREREQUISITE NOT YET BUILT.**

Computing "Years ready" requires a per-year required-docs matrix that does not exist yet. Until it's
built, render the wrap-up's "Years ready to push" and "Years still blocked" sections as a single
placeholder line:

```
Per-year readiness:
  ⚠ Not computed — required-docs-per-year matrix not built yet (see ADR-011, TODO).
```

To enable: add a file like `Calculator/rules/required-docs-per-year.md` (or per-year property on the
existing `Calculator/rules/<year>.ts` rule modules) declaring which doc slugs each year requires.
Then this skill cross-references `have`-status doc slugs against that matrix to bucket years into
`ready` / `blocked`. Do not fake it before the matrix exists — silently-wrong year readiness would
push the user to file an incomplete year.

## Response style

How this skill talks to the user. Built up over time.

- **Very concise.** Report standing in a few scannable lines, not a wall. Lead with the next action.
- **Use the `We have / We're missing / Next step / Continue? y/n` shape** from §2. No stage tables, no document tables, no internal-playbook links.
- **Full names + Hebrew in parens.** No slugs, no English-only abbreviations for Israeli tax artifacts.

## Rules

- **Route, don't duplicate.** Worker logic stays in the worker skill. This skill reads state and dispatches.
- **Single writer (ADR-011).** Do **not** write document rows — `get-doc` owns those. This skill may
  update only the `## Stages` line it owns (e.g. flip Collect → `done` when no docs remain) and
  re-stamp `Last updated: <date> by robintax`.
- **No PII/credentials** in anything written to the ledger — same sanitization as the workers.

## Related

- [ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md) — the journey ledger contract.
- [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — explain + gate scary actions.
- [ADR-012](../../docs/decisions/ADR-012-apple-reminders-for-pending-docs.md) — Apple Reminders substrate + cohort rule used by WRAP-UP and AUTO-RECHECK.
- `get-doc` (`skills/get-doc/`) — the collection-stage worker this skill routes to.
- `calc-refund` (`skills/calc-refund/`) — the calculation-stage worker this skill routes to.

## Windows reminder backend — TODO

ADR-012's Apple Reminders substrate is macOS-only. A Windows-equivalent backend exists in principle but is not built. Sketch:

| Apple Reminders (macOS) | Windows equivalent |
|---|---|
| `osascript … make new reminder with due date` | `schtasks /create /sc once /st <HH:mm> /tr "powershell -c New-BurntToastNotification …"` |
| `osascript … return completed of reminder id "X"` | `schtasks /query /tn "RobinTax-<cohort>"` + parse "Last Run Result" |
| `osascript … delete reminder id "X"` | `schtasks /delete /tn "RobinTax-<cohort>" /f` |
| `osascript … set name of reminder id "X" …` | delete + recreate (Task Scheduler does not edit task names cleanly) |

Until built, Windows users get degraded behavior: no OS reminder fires; recheck only happens when the user manually runs `/robintax` and the cohort ETA has passed.
