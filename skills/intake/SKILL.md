---
name: intake
description: Eligibility intake — the first stage of /robintax. Use when the user invokes `/intake`, or when `/robintax` routes here because the per-user profile at `<memory>/profile.md` is missing or the user asked to update it. Renders a flat eligibility checklist via multi-select `AskUserQuestion` panels, then batches all follow-ups from the relevant `tax-rule/<slug>.md § Intake` specs, writes a sanitized profile, seeds the journey ledger with the docs the profile implies. Slash-command or router-invoked only — do NOT auto-fire on phrases like "let's start my taxes."
---

# intake — checklist → batched follow-ups → profile

The first stage of `/robintax`. Owns `<memory>/profile.md` (see [ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md)) and seeds the journey ledger's `## Documents` table with the docs the profile implies.

Two layers:

- **Sources of truth** — [`Intake/checklist.md`](../../Intake/checklist.md) lists every selectable eligibility item; each maps to a `tax-rule/<slug>.md` (or `none` for v2-stubs). For items with real specs, follow-ups live in `tax-rule/<slug>.md § Intake`.
- **Walker** — this skill. Renders the checklist as multi-select panels, runs the disqualifier soft-gate, batches follow-ups from tax-rule specs, writes the profile, seeds the ledger.

## Workflow

> **Run silently — do NOT narrate.** The only things the user should see from intake are: the §3 PREAMBLE text, the §4 checklist panels, the §7 follow-up panels, and the §11 handoff line. **Never** print section numbers (`§1`, `§3`, `§4`…), **never** announce internal steps ("I'm in the intake skill", "loading the checklist", "Loaded — 30 items, N=… panels, firing in batches", "fresh first run → PREAMBLE"). Load files and compute the panel plan as quiet tool calls, then go straight to the panels. Each narrated line is a wasted Opus turn the user waits on. When in doubt: emit nothing.

### 1. READ

Three states to discriminate. Decide which branch in this order:

1. **`<memory>/profile.md` exists** → branch to **§10 RE-INTAKE** (which loads the profile then). Done.
2. **`<memory>/intake.draft.md` exists** → there's a paused intake. Check the draft's `Started:` timestamp:
   - If `now - Started > 7 days` → silently `rm` the draft file (it's stale; user has likely moved on or their tax situation changed). Continue to fresh-run branch.
   - Otherwise → branch to **§1b RESUME**. Done.
3. **Neither exists** → fresh first run. Continue to §3 PREAMBLE (the first-run welcome already ran in `robintax` §0.5 before this hand-off; intake does not re-render it).

**Do not load checklist or matrix yet.** Those reads are deferred to §3 PREAMBLE / §9 SEED so the user sees the welcome panel without an extra ~15s of file-load round-trips on cold start.

### 1b. RESUME (only if draft exists and ≤7 days old)

Read `<memory>/intake.draft.md` in full. It records cumulative state across §4 / §6 / §7 (format spec below at §8b DRAFT FORMAT). Render a one-message summary of what's saved, then ask **one** single-select `AskUserQuestion` panel — Hebrew-only labels per the global rule:

```
מצאתי שאלון אינטייק שהתחלת לפני <human time, e.g. "23 דקות" / "יומיים">.
נשמר:
  • צ'קליסט: <N> פריטים נבחרו
  • שנים לבדיקה: <"כל השנים 2020–2025" or "<list>">
  • סוג הכנסה: <income mode>
  • שאלות המשך: <M> מתוך <Total> נענו
```

Panel options:
1. `המשך מאיפה שעצרתי` (default)
2. `התחל מחדש`

- Option 1 → jump to the first non-`done` section recorded in the draft, restoring `selected`, `filing.*`, and `branches` from the draft as you go. Skip §3 PREAMBLE and any already-`done` section. For §4 partial state, resume at `next_panel_index`. For §7, rebuild the queue from `selected` + tax-rule specs and skip any key already in `branches`.
- Option 2 → `rm` the draft file, then fall through to §3 PREAMBLE as a fresh run.

After §1b, the rest of the workflow continues normally — every section still writes/updates the draft at its boundaries per §8b.

### 2. WELCOME — moved to robintax

The first-run welcome (the "Welcome to RobinTax / The process" box + the start/decline gate) now lives in **`robintax` §0.5 FIRST-RUN WELCOME**, which runs *before* it hands off to intake. Intake no longer prints a welcome and no longer asks "Continue? y/n" — robintax's consent panel is the start-gate. A fresh run goes straight from §1 READ to §3 PREAMBLE.

(If `/intake` is invoked **directly** by a returning user, §1 READ routes to §10 RE-INTAKE, which has its own intro. There is no path where intake needs to render the first-run welcome itself.)

### 3. PREAMBLE

Print exactly once, before any question:

```
I'll ask a bunch of questions to make sure we catch every credit (זיכוי מס) you deserve.
You can always answer "I don't know" — if a credit might apply, we'll just try to fetch
the proof document anyway and let it speak for itself.
```

Now load [`Intake/checklist.md`](../../Intake/checklist.md) — parse every line under `## Items` into `{slug, label, tax_rule_slug, flags}`. Preserve listed order across groups; groups are editorial only. (Deferred from §1 READ so the welcome panel renders without an extra round-trip.)

Then proceed straight to §4. **Do not ask "ready? y/n"** — robintax's §0.5 consent panel + this preamble are the gate (per [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) gate-once rule and [[feedback_approval_frequency]]).

### 4. CHECKLIST

Render the checklist items as a continuous run of multi-select `AskUserQuestion` panels:

1. **Each panel** is `multiSelect: true`. Options are the checklist items' Hebrew labels — **up to 4 items per panel** (the last panel may have fewer). Compute `N` (total panel count) up-front for the `i/N` signal, e.g. 24 items → `N = 6`. **Exception:** the *last panel of each `AskUserQuestion` call* reserves its final slot for the "none" chip (§4.5), so that one panel carries **≤3 items + the chip**. The chip therefore appears once per screen/call, not on every panel.
2. **Batch panels into `AskUserQuestion` calls of up to 4 panels per call.** The tool accepts 1–4 questions per call; pack them. So 6 panels collapse to 2 calls (4-then-2), not 6 calls. Same number of screens for the user, fewer model turns = less inter-panel latency. **Do not** make any other tool calls (no Read, no Bash, no thinking output) between consecutive `AskUserQuestion` calls.
3. **Panel question text** carries the hint in the *question itself* (not under an option): `{i}/{N} Select everything that applies. Not sure? Select it — we'll check together.` `i` is the 1-indexed panel number, continuous across calls (panel 5 in call 2 is still `5/6`). To avoid repetition you may drop the "Not sure?" sentence after the first panel of each call.
4. **Option label**: the Hebrew label from `Intake/checklist.md` for that slug, with an **empty `description`** (per [[feedback_intake_hebrew_only]] — never an English gloss). Do **not** show the slug or the `tax-rule:` mapping — those are walker internals.
5. **The "none" chip — once per call, on the call's last panel.** The last panel in each `AskUserQuestion` call gets a final option `לא, אף אחד מאלה` (Hebrew-only, empty `description`). It guarantees every call has at least one positively-answerable option, so a submitted-but-empty call is no longer reported as "the user did not answer" — which is what `AskUserQuestion` otherwise can't distinguish from a *dismissed* call (the root cause of the re-fire bug, issue #3). Do **not** put it on every panel — that's clutter. It's mutually exclusive in spirit: if the user checks it **and** a real item anywhere in the call, the real items win (ignore the chip).
6. **`i/N` is the only progress signal.** No section headers, no Hebrew labels above the panel.
7. Maintain `selected = []`. After each panel (within a call or across calls), append every checked **real** item's slug — never the none chip.
8. **Empty / "none" → advance, NEVER re-fire.** If a panel comes back with nothing checked, or the call's none chip is what got checked, that's a valid "none of these apply": append nothing and **fire the next panel/call immediately**. Do NOT re-fire. Do NOT pause to ask "are you sure?" or "did you mean to skip?". Do NOT summarize progress mid-run. Only break out if the user explicitly types something (outside the panel) telling you to stop.

Continue until the checklist is exhausted. Do not write anything to disk yet.

### 5. DISQUALIFIERS

If `selected` contains any item flagged `(disqualifier)` in the checklist:

1. Ask one `AskUserQuestion` panel — up to 4 questions per call. Each question is a yes/no chip with the disqualifier's Hebrew label as the question text. Panel header (first question's text prefix): `Quick sanity check: `.
2. If **every** disqualifier flips to `no` (mis-click) → remove them from `selected` and continue to §6 FOLLOW-UPS.
3. If **any** disqualifier confirms `yes`:
   - Write a partial `<memory>/profile.md` with: `## Filing scope` → `Years: pending`; `## Eligibility branches` → every `selected` slug as `yes` / `unknown`; `## Disqualified` → confirmed disqualifier slugs. Stamp `Last updated: <today> by intake`.
   - Print the v1 short-circuit message (template in [`Intake/checklist.md`](../../Intake/checklist.md) under "Disqualifier soft-gate"), substituting the bracketed list with the confirmed disqualifiers' Hebrew labels.
   - **STOP.** Do not run §6, do not seed the ledger.

### 6. FILING SCOPE

Before follow-ups, ask filing-scope questions. **Compute the filable window once:** `years_window = [current_year - 6 .. current_year - 1]` (e.g. on 2026-06-21 → `[2020, 2021, 2022, 2023, 2024, 2025]`). Hebrew labels throughout.

**Step 6a — scope shape (single-select, one panel):**

Question: `אילו שנים נבדוק?` — set the panel description to one short line explaining why `{current_year}` isn't on the list: `שנת המס {current_year} עדיין לא הסתיימה, אז אין עליה החזר לבדוק עדיין.` (substitute the actual current year).

Options:
1. `כל השנים האפשריות ({first}–{last})` — substitute the computed window, e.g. `כל השנים האפשריות (2020–2025)`. This is the **first** option (most users want the full retro check; one click and done).
2. `שנה ספציפית או כמה שנים מסוימות`

Also ask `Income mode?` in the same panel call (so it's one round-trip, not two):

Question: `איזה סוג הכנסה הייתה לך באותן שנים?`
- `שכיר בלבד`
- `שכיר + הכנסה צדדית קטנה`
- `לא יודע/ת`

**Step 6b — year picker (only fires if user picked "specific year" at 6a):**

Multi-select panel. Question: `איזו שנה (או שנים)?`. Chips = the computed `years_window`, **descending order** (latest year first, since users tend to think about recent years first): e.g. `2025` `2024` `2023` `2022` `2021` `2020`. No `Older` chip (out of filable window), no `I don't know` chip (the user explicitly said they wanted specific years — if they don't know, they should have picked the "all years" option at 6a; re-firing 6a after a blank is unnecessary friction).

If 6a returned "all years" → `filing.years = years_window` (the full list); skip 6b entirely.
If 6a returned "specific year" → fire 6b, store the multi-select result as `filing.years`.

Store income mode under `filing.income_mode`.

### 7. FOLLOW-UPS

For every `selected` slug that is **not** a disqualifier:

1. If the item's `tax-rule:` is `none`:
   - Record `profile.branches[slug] = 'yes'` if the user explicitly checked it (the checkbox itself is the gate answer). No follow-ups to ask.
2. If the item has a real `tax-rule: <slug>`:
   - Read `tax-rule/<slug>.md`. Parse the `## Intake` section. If `## Intake` is missing → treat the item as v2-stub (record `yes`, skip follow-ups).
   - Extract the rule's display **Category** (a short label — derive from the spec's H1, e.g. `## §39A — Discharged Soldier Credit` → `Soldier`; for `degree-40c-40d` → `Degree`). Cache `category[slug]`.
   - The checklist check already answered the gate, so **skip the gate** and queue every entry under `### Follow-ups` into the global follow-up queue, tagged with `{slug, category, conditional}`.
3. If the item is `(free-text)`: append a sentinel `{slug, free_text: true}` to the end of the queue.

Title rule: every follow-up's question text begins with `{Category} {i}/{N}: ` where `i` is 1-indexed and `N` is the count of follow-ups queued for that slug. Example for the soldier case with 4 follow-ups: `Soldier 1/4: Which track did you serve in?`, …, `Soldier 4/4: ...`.

Firing rule: batch follow-ups into `AskUserQuestion` calls of up to 4 questions each. Pack across slugs — if the soldier batch has 3 follow-ups, fit a 4th from the next slug into the same call. **Do not** make any other tool calls (no Read, no Bash, no thinking aloud) between consecutive `AskUserQuestion` calls. Conditional follow-ups (e.g. `medical_early_discharge` only if `service_length_band ∈ {Less than 12 months, I don't know}`) are deferred to a later panel — evaluate the condition after the prior answer lands.

Free-text items: render as an **`AskUserQuestion` panel** at the very end of the follow-up batch (not a plain message — plain messages force the user to type "no" just to dismiss). Question text is the Hebrew label from `Intake/checklist.md` for that slug. **Single-select**, with exactly **one** explicit option:

1. `לא, אין משהו נוסף` — Hebrew-only label, no description.

The harness automatically appends an `Other` choice that opens a free-text input — that's the "type something" path. Do **not** add a second explicit `כן, יש לי מה לציין` option; it would render alongside the auto-`Other` and the user would see three muddled choices for what is really a two-way ask.

Branching:
- User picks `לא, אין משהו נוסף` → omit the slug from the profile entirely (do not write `no`).
- User picks `Other` and types text → record `profile.branches[slug] = '<user text>'`.

Most users pick `לא`, so this collapses to a single click instead of a free-text prompt the user has to actively dismiss.

### 8. WRITE PROFILE

After the last follow-up, write `<memory>/profile.md`. Shape:

```markdown
# Profile (intake)
Last updated: <YYYY-MM-DD> by intake

## Filing scope
- Years to file: 2022, 2023, 2024
- Income mode: salaried only

## Eligibility branches
- Soldier (§39A): yes — track IDF, discharge 2022, long-service
- Degree (§40C/40D): yes — completed 2023
- Children: yes
- Job change: yes
- Donations: unknown
- Settlement (§11 יישוב מזכה): no   ← only present if user explicitly unchecked after considering; otherwise omit unchecked items
```

**Sanitization (same as the ledger):**
- No names, no ת.ז., no addresses, no NIS amounts.
- Dates ok (year/month is enough — drop the day where possible).
- Each checked checklist slug becomes one line. For slugs with real specs, append the follow-up qualifiers; for v2-stubs, just `yes` (or `unknown` if the user picked an "I don't know" follow-up that the engine has). Unchecked slugs are omitted (not written as `no`).

Stamp `Last updated: <today> by intake`.

**After writing the profile, `rm <memory>/intake.draft.md`.** The draft only exists to survive mid-intake kills; once §8 succeeds the profile is the source of truth and the draft is noise.

### 8b. DRAFT FORMAT (referenced by §1b RESUME and section save-points)

The draft at `<memory>/intake.draft.md` is intake-internal scratch state, written incrementally after every `AskUserQuestion` call returns and deleted at §8. Format:

```markdown
# Intake draft (in progress)
Started: 2026-06-21T14:00:00Z
Last updated: 2026-06-21T14:07:00Z

## §4 CHECKLIST
status: in-progress     # or "done"
selected: soldier, degree, btl_income
next_panel_index: 4     # 1-indexed; only meaningful if status: in-progress

## §6 FILING SCOPE
status: done            # or "pending" if §4 not done yet
years: 2020, 2021, 2022, 2023, 2024, 2025
income_mode: שכיר בלבד

## §7 FOLLOW-UPS
status: in-progress     # or "done"
answered:
  soldier.service_track: IDF
  soldier.discharge_year: post-2017
```

**Save points (mandatory):**
- After each §4 panel returns: update `selected` and `next_panel_index`.
- After §4's last panel: flip `## §4` `status: done`.
- After §6: write `## §6 FILING SCOPE` section, `status: done`.
- After each §7 `AskUserQuestion` call returns: add answered keys to `answered:` under `## §7`. Flip §7 `status: done` after the last queue item.
- After §8 WRITE PROFILE succeeds: **delete the draft file** (`rm`).

Sanitization: same as the profile — no PII, no ת.ז., no amounts. Free-text answers (the `other_expenses` case) ARE preserved verbatim because that's user-authored content the model can't reconstruct on resume.

Don't pre-create the draft; only write it once §4 has its first panel result to save. If the user kills before answering anything, no draft exists and the next run is a clean fresh-start.

### 9. SEED LEDGER

Now load [`Intake/required-docs-matrix.md`](../../Intake/required-docs-matrix.md) (deferred from §1 READ — only needed here). For each matching `(branch state) × declared filing year`:

- If the doc slug **already exists** in `<memory>/journey.md` `## Documents` → leave it alone (especially do not overwrite `have` or `requested` rows).
- Otherwise insert a `todo` row. Annotate `(year)` or `(spouse YYYY)` per the matrix's "Per year?" column.
- For unambiguously-irrelevant slugs (not selected) → do **not** insert an `n/a` row. Just omit. (Accretion stays the default for unknown docs.)

Flip the `## Stages` table's `Intake` row to `done` and stamp the file `Last updated: <today> by intake`.

**If the matrix references a doc slug that has no playbook in `Collector/documents/`** → do NOT seed a `todo` row for it. Instead print the manual instruction under a `Manual steps:` section in the wrap-up message. Reason: `get-doc` would fail on a missing playbook; surfacing the manual step is more honest.

### 10. RE-INTAKE

If `<memory>/profile.md` already exists:

1. Read the existing profile and summarize in one short message: `You previously told me: <one-line summary>. Anything changed?`
2. `AskUserQuestion` panel with options: `Nothing changed` | `Re-walk the whole checklist` | `Update specific items`.
3. **Nothing changed** → exit, no writes.
4. **Re-walk** → load [`Intake/checklist.md`](../../Intake/checklist.md) now (re-intake skips §3 PREAMBLE where fresh runs load it), then fall through to §4 CHECKLIST with previous selections pre-checked in each panel (so the user can press through unchanged answers fast). Continue through §5–§9 normally.
5. **Update specific items** → load [`Intake/checklist.md`](../../Intake/checklist.md) now, then second `AskUserQuestion` panel with previously-selected slugs as multi-select; ask only those items' follow-ups (jump to §7 with the chosen subset), preserve the rest of the profile, write updates.

**On re-intake, NEVER regress already-collected docs.** §9 SEED's "leave existing rows alone" rule covers this — but be especially careful not to insert duplicate `todo` rows for `have`-status docs.

### 11. HANDOFF

Print **one short paragraph** (~3 lines max) confirming the profile was saved + any non-obvious exclusions — things the user mentioned that we deliberately did NOT seed (e.g. "degree finished ~2016, §40D credit window 2017–2018 is before your earliest filable year, so we're not pulling it"). **Do not enumerate the doc list here** — that's `robintax` §2 REPORT's job; duplicating it forces the user to read the same list twice.

Example:

```
פרופיל נשמר. הערה אחת: תעודת הטכנאי הסתיימה ב~2016, חלון §40D (2017–2018) קודם לשנים שאתה מגיש — לא נביא אותה.

ממשיך לתכנון איסוף המסמכים...
```

(Hebrew where natural — these aren't `AskUserQuestion` panels, so the strict Hebrew-only rule doesn't apply, but Hebrew reads faster for the user.)

**Auto-invoke `Skill(robintax)` immediately after the handoff message.** Robintax's READ → REPORT → PICK NEXT → GATE flow renders the standing (`We have / We're missing`), proposes collection, and asks the user to approve before opening the browser. Intake should not re-implement that surface — just hand off.

The earlier rule was "do not auto-route, let the user choose." We flipped that on 2026-06-21: forcing the user to type `/robintax` after a 6-10 min intake is dead air — the natural next step is to show them what they need and ask permission to start collecting.

## Rules

- **Single writer.** Only `intake` writes `<memory>/profile.md`. Per [ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md).
- **No PII.** Same sanitization as the ledger ([ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md)).
- **`AskUserQuestion`, not free text** — except for genuinely open answers (`(free-text)` items, dates, counts). Free text should be the exception.
- **Tri-state on follow-ups.** Every follow-up that has a gate-like shape is `yes | no | I don't know`. Never collapse `unknown` into `no`.
- **Pessimistic include on `unknown`.** Seed the proof doc as `todo`; let the doc resolve the question. Calculator does NOT count `unknown` as a credit until a `have` doc confirms.
- **Checklist + tax-rule specs are the source of truth.** Don't hard-code questions in this skill. Don't invent follow-ups. If a slug's `tax-rule:` is `none`, just record `yes` — never make up a follow-up.
- **No exploration between answers.** Once §7 FOLLOW-UPS starts firing panels, the only tool calls allowed until the queue drains are `AskUserQuestion` (or a final plain message for free-text). No Read, no Bash, no thinking output.
- **Skip the gate when the checkbox already answered it.** Every selected slug's tax-rule gate is already `yes` by virtue of the check — don't re-ask.
- **Gate-once.** The preamble is the gate. Don't re-confirm between sections.
- **Hebrew in parens.** Same naming rule as `robintax` §2 REPORT — except inside `Intake/checklist.md` panel options, which are Hebrew-only.
- **No description under any option — descriptions are always empty.** In the §4 CHECKLIST panels, each option's `label` is the Hebrew checklist text and its `description` field is **left empty** — do NOT fill `description` with an English translation, gloss, restatement, or the "not sure" hint. The "Not sure? Select it" hint now lives in the **question text** (§4.3), not under an option. Reason: bilingual labels and per-option subtitles clutter the panel and slow the user down — the Hebrew label is the answer.
- **Don't auto-route.** End with a report; let the user decide whether to run `/robintax` or `/get-doc` next.

## Anti-patterns

- Asking the same question via free text after the user already answered via `AskUserQuestion`.
- Re-firing a checklist panel because the user submitted it with the "none" chip (or nothing) checked. That's a valid "none of these apply" — fire the next panel. See §4.5 (the chip) + §4.8 (advance, never re-fire).
- Pausing mid-checklist to summarize progress, list what's been selected so far, or ask "should I continue?". The user already committed at robintax's §0.5 consent panel and §3 PREAMBLE — keep firing panels until the checklist is exhausted.
- Inventing follow-ups for slugs whose `tax-rule:` is `none`. If there's no spec, there are no follow-ups — record the gate and move on.
- Writing `<memory>/profile.md` mid-intake (incomplete state). Write once at §8, or partial-write at §5 on disqualifier short-circuit. **The draft file `<memory>/intake.draft.md` is the opposite — it IS expected to be written incrementally** (per §8b), and is the only persistence mechanism that survives a mid-intake kill.
- Forgetting to delete `<memory>/intake.draft.md` after §8 succeeds. Leaving it around means the next `/robintax` run thinks intake is paused even though the profile is final.
- Inserting `n/a` rows in the ledger for slugs that weren't selected.
- Overwriting an existing `have` row with `todo` during re-intake.
- Asking the user to confirm each panel ("ready for the next one?"). Gate once, run the batch.
- Routing **directly to `/get-doc`** automatically at the end (which would open the browser without showing standing or asking permission). The auto-route at §11 HANDOFF is to **`/robintax`**, which renders the standing first and gates on the user's approval before any browser action.
- Re-implementing the `We have / We're missing` report in §11 HANDOFF. That's `robintax` §2 REPORT — duplicating it makes the user read the same list twice.
- Pausing to read tax-rule specs in the middle of §7. Read them all up-front when building the follow-up queue.

## Related

- [Repo ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md) — profile contract.
- [Repo ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md) — ledger contract (this skill seeds it).
- [Repo ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — gate-once.
- [`Intake/`](../../Intake/) — the service this skill operates on.
- [`Intake/checklist.md`](../../Intake/checklist.md) — the eligibility surface this walker renders.
- [`Intake/required-docs-matrix.md`](../../Intake/required-docs-matrix.md) — what to seed.
- [`tax-rule/`](../../tax-rule/) — per-rule canonical specs; the `## Intake` section is the follow-up source.
- [`.claude/skills/robintax/SKILL.md`](../robintax/SKILL.md) — the caller; routes here when profile is missing.
- [`.claude/skills/get-doc/SKILL.md`](../get-doc/SKILL.md) — the next stage's worker; reads the seeded ledger.
