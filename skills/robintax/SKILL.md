---
name: robintax
description: Front door for a user's tax-refund run. Use when the user invokes `/robintax` to resume — "where did I leave off", "continue my tax return", "run the next step". Reads the per-user journey ledger, reports standing across all stages (collect → calculate → file), and routes to the right worker skill (today: get-doc). Slash-command-style entry point; routes rather than re-implementing worker logic.
---

# robintax — resume the tax return and run the next step

The orchestrator / front door. It owns **reading** the journey ledger and **routing** to worker
skills. It does not fetch documents, calculate, or file itself — workers do that.

Three layers (see [ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md)):

- **State** — the ledger at `<memory>/journey.md` (`<memory>` = `~/.claude/projects/<project>/memory/`) and the profile at `<memory>/profile.md` (the latter per [ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md)).
- **Orchestrator** — this skill.
- **Workers** — `intake` (eligibility intake, built — first stage); `get-doc` (collection, built); `calc-refund` (calculation, built — engine + 2020–2025 rule tables + verifier all in place); `file` (not built yet).

## Workflow

> **Run the first-run silently and in as few turns as possible — do NOT narrate.** The user must see ONLY, in this order: the welcome box (§0.5.1), the consent panel (§0.5.2), then — after handoff — intake's preamble and questions. **Never** print section numbers (`§0`, `§0.5`, `§1b`…), **never** announce steps ("I'll start with the silent check", "This is a genuine first run", "Consent given, running setup", "Handing off to intake", "Setup complete"), **never** describe what you're about to do. These `§`-labels are internal scaffolding, not a script to read aloud. Run the mechanical work (the Read check; the post-consent `mkdir` + `uname` + `platform.md` write) as **tight batched tool calls — one turn, no thinking-out-loud between them**. Every narrated line is a wasted Opus turn the user sits and waits on (this is why the first run felt slow). When in doubt: emit nothing.

### 0. NEW-vs-RETURNING check (silent, `Read`-only — the ONLY thing before any output)

The only work allowed before the user sees anything is detecting whether this is a fresh install. Do it with the **`Read` tool — never Bash** (`test` / `ls` / `mkdir`). Reads of the memory dir never prompt, so this adds no permission gate; a Bash check here would fire a permission prompt *before* the welcome — exactly the premature-prompt bug we're removing.

`Read` `<memory>/profile.md` and check whether `<memory>/intake.draft.md` exists:

1. **profile.md exists** → **returning user.** Skip §0.5 entirely. Continue to §1b AUTO-RECHECK → §2 REPORT. No Hello, no welcome, no consent panel — the REPORT is their greeting.
2. **profile.md missing, draft exists** → **paused intake.** Print exactly one line (`Found a paused intake from <human time> ago — picking up where you left off.`) and invoke `Skill(intake)` (its §1b RESUME takes over). The user already consented on the run that created the draft, so skip the consent panel. Not a "first run."
3. **profile.md missing, no draft** → **genuine first run** → §0.5 FIRST-RUN WELCOME.

**Do not `mkdir`, detect platform, or run any Bash here** — the `~/Downloads/RobinTax` folder is created by the SessionStart hook, and platform detection is deferred to collect-time (see §0.5.3). The only thing that happens before the welcome is the `Read` above. If the **ledger** is missing but the profile exists, that's unexpected — flag it and recover by routing to `/intake` re-walk.

### 0.5 FIRST-RUN WELCOME (new users only)

The user's very first screen. **robintax — not intake — owns this surface now.**

1. **Hello + the process** — print verbatim (English, unchanged from intake's old §2):

   ```
   Welcome to RobinTax,
   Let's get your money back!

   The process:
     1. Intake questions
     2. We'll browse Chrome *together* to get documents
     3. Calculate what you deserve
     4. Fill up the form!
   ```

2. **Consent panel (`AskUserQuestion`, Y/n gate).** Disclose the local actions and give a real out. The narrow perms (memory writes, the `~/Downloads/RobinTax` folder, the `uname` platform probe) are already seeded by the SessionStart hook — so this panel is *disclosure + decline*, not the grant mechanism.
   - Question: `Ready to start? I'll keep notes in my own memory and save your documents to ~/Downloads/RobinTax — nothing leaves your machine.`
   - Option 1 (default): `Yes, start the intake questions`
   - Option 2: `Not now`
   - On **Not now** → exit cleanly with one line (`No problem — run /robintax when you're ready.`). Do **not** start intake.
   - On **Yes** → continue ↓

3. **On Yes → no setup commands here. Run NOTHING that prompts.** Do **not** `mkdir` and do **not** detect platform on the first run — both would fire a raw permission prompt right after the consent panel (a freshly-seeded grant isn't active until the next session, and a literal `~` wouldn't match an absolute-path grant). Instead:
   - The `~/Downloads/RobinTax` folder is already created by the **SessionStart hook** (`hooks/install-deps.sh`), which runs without prompts. Assume it exists; never `mkdir` it from here.
   - **Platform detection is deferred to collect-time** (`get-doc` preflight writes `<memory>/platform.md` if missing, inside its own consented flow where `Bash(uname*)` is active). The internal capability matrix (macOS → Apple Reminders + `split-screen.sh`; Windows/Linux → degraded) is only consulted at collect/reminder time, so there's nothing to detect during the first-run welcome. Never print a "you're on macOS…" preamble.

4. **`Skill(intake)`** — go straight here, silently. Intake opens at its first question (its welcome moved to this §0.5). No prompting Bash ran after the consent panel.

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
- **Israeli government bodies use their native Hebrew name, not English abbreviations or transliterations.** When prose refers to the issuing body or its portal, write `רשות המיסים` (or `אתר רשות המיסים` for the site) — NEVER `ITA`, NEVER `Israeli Tax Authority`. Likewise: `ביטוח לאומי` / `אתר ביטוח לאומי`, never `BTL` or `Bituach Leumi`. Likewise: `צה"ל`, never `IDF`. This is intentionally different from the doc-naming rule above: **document names** are English-with-Hebrew-in-parens (`Form 106 (טופס 106)`); **issuing-body names** are Hebrew-only because that's how Israelis actually refer to them in daily life. Code identifiers (`ita.gov.il`, slug `bituach-leumi-payments`, schema `bituach_leumi_rates`) are code, not prose — they stay as-is. See [[feedback_no_btl_acronym]] for the full rationale.

Linking rules:

- **Do not link doc names to the `Collector/documents/<slug>.md` research files** — those are internal playbooks, not useful to the user.
- If a doc is `have`, you may link to the **actual file path** from the ledger's `File` column (e.g. `~/Downloads/RobinTax/...`). If the path is a glob or unclear, just don't link — bare text is fine.
- Skip links for `requested` / `blocked` / `todo` rows.

### 3. PICK NEXT

Walk stages top-down; act on the first one that isn't `done`.

- **Intake** → hand to `/intake` if `<memory>/profile.md` is missing OR the `Intake` stage row is not
  `done`. Intake writes the profile and seeds the ledger; this skill returns to its routing loop
  afterwards. See [ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md). The user can
  also re-run `/intake` directly any time to update their profile.
- **Collect documents** → hand to `get-doc`:
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

**Gate text rule — name the scary action.** Every gate that's about to open the browser MUST phrase the question as `Open <Hebrew site name> in Chrome? [Y/n]` — never the generic `Continue? [Y/n]`, never the half-named `Continue to <site>? [Y/n]`. The user has to know *which site* is about to open before they say yes. Hebrew name per §2 naming rules (`אתר ביטוח לאומי` not `BTL` or `Bituach Leumi`; `אתר רשות המיסים` not `ITA`).

Examples:
- First doc, Form 106: `Open אתר רשות המיסים in Chrome? [Y/n]` (combined with the first-collect explainer box below).
- Second doc, Bituach Leumi payments: `Open אתר ביטוח לאומי in Chrome? [Y/n]`.
- IDF cert: `Open אתר תשלומים והפקת אישורים של צה"ל in Chrome? [Y/n]` (or whichever exact portal name is in the playbook).
- Council/manual-email case (no browser): use `Continue? [Y/n]` since no Chrome action — there's no site to name.

**First-collect gate — special case.** When the ledger has **zero `have` docs** AND the next step is collection (i.e. this is the user's first time about to open the browser for this whole tax run), include the boxed "how it works" explainer between `Next` and `Continue?`. After the first successful collection, subsequent collect gates skip the box and just use the bare `Next step / Continue? [Y/n]` shape from §2 REPORT — the user has seen the mechanics by then.

Exact shape for the first-collect gate:

```
We're missing:
  1. <Full doc name (Hebrew name)> — <years or "once">
  2. ...

Next: <Full doc name (Hebrew name)>
   <one-line "why this one first" reason>

  ┌─ How collection works ───────────────────────────────┐
  │  • I open YOUR Chrome — your profile, your sessions  │
  │  • YOU log in — I never see your password            │
  │  • I click through to download once you're in        │
  │  • PDFs land in ~/Downloads/RobinTax/                │
  └──────────────────────────────────────────────────────┘

Open <Hebrew site name> in Chrome? [Y/n]
```

Box rules:
- Use the box-drawing characters shown (`┌─┐│└─┘`) verbatim — do not substitute ASCII `+---+|`.
- The box body is exactly those 4 bullets in that order. Don't paraphrase; the wording is load-bearing (per [ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md) — credentials never proxy through us, and the user has to know that before they type a password into a browser we just opened).
- The gate question follows the §4 "Gate text rule" above: `Open <Hebrew site name> in Chrome? [Y/n]` — e.g. `Open אתר רשות המיסים in Chrome? [Y/n]` for Form 106. The site name MUST match the next doc's actual portal in Hebrew; never use the generic `Continue?` or `Open Chrome and start?`.
- Show the box exactly once per "first collect ever" — if the user accepts and the ledger now has `have` rows, subsequent gates use the bare §2 REPORT shape.

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

**Per-year completeness gate.**

Compute "Years ready" by cross-referencing the user's declared filing years (from `<memory>/profile.md`'s
`## Filing scope`) with [`Intake/required-docs-matrix.md`](../../Intake/required-docs-matrix.md). For each
declared year, walk the doc slugs that match the user's profile state (always-rows + rows whose branch
state is `yes` or `unknown`). A year is **`ready`** when every implied slug is `have` in the ledger;
otherwise **`blocked`** on the missing slugs.

Do not infer required docs from any other source. If `<memory>/profile.md` is missing, render the
section as `⚠ Profile missing — run /intake first` and don't guess.

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
- [ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md) — user profile + intake as the first stage.
- `intake` (`skills/intake/`) — the intake-stage worker this skill routes to first.
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
