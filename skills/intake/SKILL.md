---
name: intake
description: Eligibility intake — the first stage of /robintax. Use when the user invokes `/intake`, or when `/robintax` routes here because the per-user profile at `<memory>/profile.md` is missing or the user asked to update it. Walks the v1 eligibility branches via `AskUserQuestion` panels, writes a sanitized profile, seeds the journey ledger with the docs the profile implies. Slash-command or router-invoked only — do NOT auto-fire on phrases like "let's start my taxes."
---

# intake — ask the user what they're eligible for, write the profile

The first stage of `/robintax`. Owns `<memory>/profile.md` (see [ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md)) and seeds the journey ledger's `## Documents` table with the docs the profile implies.

Two layers:

- **Branch files** — [`Intake/branches/<name>.md`](../../Intake/branches/) declare the gate question, follow-ups, doc seeds, and calculator rule keys for each eligibility dimension. The walker is generic; adding a branch is editing a markdown file.
- **Walker** — this skill. Reads branch files in order, asks `AskUserQuestion` panels, writes the profile, seeds the ledger.

## Workflow

### 1. READ

- Load `<memory>/profile.md` if it exists. If present → branch to **§7 RE-INTAKE**. Otherwise continue fresh.
- Load every file in [`Intake/branches/`](../../Intake/branches/). Skip any with `Status: v2-stub` — they're placeholders. Sort by the `Order:` field where present; for branches without an `Order:` field, append after the ordered ones in filename order.
- Load [`Intake/required-docs-matrix.md`](../../Intake/required-docs-matrix.md) for §5 SEED.

### 2. PREAMBLE

Print exactly once, before any question:

```
I'll ask a bunch of questions to make sure we catch every credit you deserve.
You can always answer "I don't know" — if a credit might apply, we'll just try to fetch
the proof document anyway and let it speak for itself. Should take 2–3 minutes.
```

Then proceed straight to §3. **Do not ask "ready? y/n"** — the preamble is the gate (per [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) gate-once rule and [[feedback_approval_frequency]]).

### 3. ASK

For each v1 branch in order:

1. **Lead with progress.** First line of every `AskUserQuestion` call's first question reads `Section N of M: <Branch name>` (e.g. `Section 3 of 6: IDF service`).
2. **Batch where the branch file allows it.** If the branch has multiple non-conditional questions (like `household.md`), put them in one `AskUserQuestion` call (up to 4 per call). If a question is conditional on a gate, ask the gate first, then on `yes`/`unknown` ask the follow-ups in a second call.
3. **Always include the "I don't know" option** for every eligibility gate. Phrase it exactly `I don't know` so the walker can detect it consistently. (For non-gate questions like marital status, include `I'm not sure` or `Other` where it makes sense.)
4. **Free-text follow-ups** (e.g. `kids_count`, `discharge_date`) — ask via plain message, not `AskUserQuestion`. Free-text only when the answer is genuinely open (a date, a count, a name).

Walker state is a dict `profile = { <branch_key>: <answer>, ... }`. Maintain it in working memory across questions; do not write to disk yet.

### 4. WRITE PROFILE

After the last branch, write `<memory>/profile.md`. Shape:

```markdown
# Profile (intake)
Last updated: <YYYY-MM-DD> by intake

## Filing scope
- Years to file: 2022, 2023, 2024
- Income mode: salaried only

## Household
- Marital: married
- Spouse income: yes (salaried)
- Kids: 2 (ages 4, 7 as of 2025-12-31)

## Eligibility branches
- Soldier (§39A): yes — discharged 2022-08, long-service
- Settlement (§11 יישוב מזכה): no
- Immigrant (§35): no
- Donations (§46): unknown
```

**Sanitization (same as the ledger):**
- No names, no ת.ז., no addresses, no NIS amounts.
- Dates ok (year/month is enough — drop the day where possible).
- "Yes / no / unknown" + a short qualifier where the branch needs one (band, type, year).

Stamp `Last updated: <today> by intake`.

### 5. SEED LEDGER

Read [`Intake/required-docs-matrix.md`](../../Intake/required-docs-matrix.md). For each matching `(branch state) × declared filing year`:

- If the doc slug **already exists** in `<memory>/journey.md` `## Documents` → leave it alone (especially do not overwrite `have` or `requested` rows).
- Otherwise insert a `todo` row. Annotate `(year)` or `(spouse YYYY)` per the matrix's "Per year?" column.
- For unambiguously-irrelevant docs (branch `no`) → do **not** insert an `n/a` row in v1. Just omit. (Accretion stays the default for unknown docs.)

Flip the `## Stages` table's `Intake` row to `done` and stamp the file `Last updated: <today> by intake`.

**If the matrix references a doc slug that has no playbook in `Collector/documents/`** (e.g. `immigrant-certificate`, `donation-receipts` as of this writing) → do NOT seed a `todo` row for it. Instead print the manual instruction from the branch file under a `Manual steps:` section in the wrap-up message. Reason: `get-doc` would fail on a missing playbook; surfacing the manual step is more honest.

### 6. HANDOFF

End the session with a single short report:

```
Profile saved. Based on what you told me, here's what we need to fetch:

  • Form 106 (טופס 106) — per year (2022, 2023, 2024)
  • Bituach Leumi payments (אישור תשלומים מביטוח לאומי) — per year
  • IDF discharge certificate (טופס 830) — once

Manual steps (no automation yet):
  • Donations receipts — email the orgs and drop PDFs in ~/Downloads/RobinTax/

Run /robintax to start collecting, or /get-doc form-106 to jump straight in.
```

Return control to the caller. **Do not auto-route to `/get-doc`** — let the user choose. (`/robintax` will route on its next invocation.)

### 7. RE-INTAKE

If `<memory>/profile.md` already exists:

1. Read the existing profile and summarize in one short message: `You previously told me: <one-line summary>. Anything changed?`
2. `AskUserQuestion` panel with options: `Nothing changed` | `Re-walk the whole intake` | `Update specific branches`.
3. **Nothing changed** → exit, no writes.
4. **Re-walk** → fall through to §3 ASK with the existing values as the *default* selection in each question, so the user can press through unchanged answers fast.
5. **Update specific branches** → second `AskUserQuestion` with the v1 branch names as multi-select; re-ask only those, write the updated profile.

**On re-intake, NEVER regress already-collected docs.** §5 SEED's "leave existing rows alone" rule covers this — but be especially careful not to insert duplicate `todo` rows for `have`-status docs.

## Rules

- **Single writer.** Only `intake` writes `<memory>/profile.md`. Per [ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md).
- **No PII.** Same sanitization as the ledger ([ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md)).
- **`AskUserQuestion`, not free text** — except for genuinely open answers (dates, counts, settlement name). Free text per branch should be the exception.
- **Tri-state gates.** Every eligibility gate is `yes | no | I don't know`. Never collapse `unknown` into `no`.
- **Pessimistic include on `unknown`.** Seed the proof doc as `todo`; let the doc resolve the question. Calculator does NOT count `unknown` as a credit until a `have` doc confirms.
- **Branch files are the source of truth.** Don't hard-code questions in this skill. Read them from `Intake/branches/<name>.md` so adding a branch = editing a markdown file.
- **Skip v2-stub branches.** Any branch with `Status: v2-stub` is not asked in v1.
- **Gate-once.** The preamble is the gate. Don't re-confirm between sections.
- **Hebrew in parens.** Same naming rule as `robintax` §2 REPORT.
- **Don't auto-route.** End with a report; let the user decide whether to run `/robintax` or `/get-doc` next.

## Anti-patterns

- Asking the same question via free text after the user already answered via `AskUserQuestion`.
- Writing `<memory>/profile.md` mid-intake (incomplete state). Write once, at the end.
- Inserting `n/a` rows in the ledger for every branch that said `no` — pollution. Just omit.
- Overwriting an existing `have` row with `todo` during re-intake.
- Asking the user to confirm each section ("ready for the next one?"). Gate once, run the batch.
- Routing to `/get-doc` automatically at the end. User's choice.

## Related

- [Repo ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md) — profile contract.
- [Repo ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md) — ledger contract (this skill seeds it).
- [Repo ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — gate-once.
- [`Intake/`](../../Intake/) — the service this skill operates on.
- [`Intake/branches/`](../../Intake/branches/) — the v1 + v2-stub branch files.
- [`Intake/required-docs-matrix.md`](../../Intake/required-docs-matrix.md) — what to seed.
- [`.claude/skills/robintax/SKILL.md`](../robintax/SKILL.md) — the caller; routes here when profile is missing.
- [`.claude/skills/get-doc/SKILL.md`](../get-doc/SKILL.md) — the next stage's worker; reads the seeded ledger.
