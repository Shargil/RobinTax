---
name: get-doc
description: Use when the user invokes `/get-doc <document>` to fetch one of the Israeli tax-refund documents catalogued in `Collector/documents/`, or `/get-doc` with no argument to resume — report where the user stands in their journey and propose the next step. Drives the user's logged-in Chrome via the `playwriter` skill, learns what worked, writes a sanitized playbook back to the document's research file, and updates the per-user journey ledger. Slash-command only — do NOT auto-fire on phrases like "get me my X."
---

# get-doc — fetch a tax-refund document and learn from the run

A 5-phase loop. Tax-refund docs only. User-invoked via `/get-doc <doc>`. Produces sanitized playbooks back into `Collector/documents/<slug>.md`, and keeps the user's journey ledger up to date.

Two entry modes:
- `/get-doc <doc>` → fetch that document (the 5-phase loop below).
- `/get-doc` with **no argument** → **RESUME mode**: report where the user stands and propose the next step (see RESUME below). Does not fetch anything until the user picks.

## First-run preflight (silent if green)

The very first `/get-doc` run in a fresh install needs the Playwriter Chrome extension attached. Before the 5-phase loop:

1. Check Playwriter is reachable: `npx playwriter@latest session new` should return a session id. If the CLI is missing, npm fetches it. If the Chrome extension is not installed yet, the command prints install instructions — relay them verbatim and stop. Expected flow:
   - Install the extension once from Chrome Web Store (link printed by playwriter).
   - Allow it to attach to your current Chrome session.
   - You'll see a yellow "Chrome is being controlled by automated software" banner — that's the extension, not an attack.
2. Ensure `~/Downloads/RobinTax/` exists: `mkdir -p ~/Downloads/RobinTax`. Idempotent.
3. On subsequent runs (session already paired, folder exists), this preflight is silent.

Per [ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md): the user owns all logins. The skill never types passwords. If a site needs login, you log in in your own Chrome; the skill polls for the dashboard signal and resumes.

## The journey ledger

Before and after every run, this skill reads/writes the per-user journey ledger at `<memory>/journey.md` (`<memory>` = the per-user `~/.claude/projects/<project>/memory/` dir). It is the cross-skill source of truth for where the user stands. Governed by [ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md):
- **It is user data.** Sanitize the same way you sanitize playbooks (see Sanitization below) — slugs, statuses, dates, file paths, short notes only. Never IDs, OTPs, names, addresses, credentials.
- **Single writer at a time**: read it, modify only the rows/sections you own, write it back, and stamp `Last updated: <date> by get-doc`.
- Doc status state machine: `todo → requested → have`, with `blocked` / `n/a` as side states. `requested` = submitted, awaiting async delivery (e.g. an emailed PDF).
- Documents row columns: `Doc (slug) | Status | Updated | File | Next action | ETA | Reminder ID`. ETA + Reminder ID only set when status is `requested`; cleared on any other transition.

## Pending-doc reminders (Apple Reminders)

When a doc flips to `requested`, create a macOS Apple Reminder so the user gets a real OS-level ping days later — even with Claude Code closed. Governed by [ADR-012](../../docs/decisions/ADR-012-apple-reminders-for-pending-docs.md). Executable detail (osascript snippets, ETA math, announce templates) lives in [lessons/apple-reminders-cohorts.md](lessons/apple-reminders-cohorts.md) — **read it before touching this code path**.

**Rules (the lesson has the how):**

- **ETA = today + 2 Israeli business days** (Sun–Thu workdays; skip Fri+Sat). Reminder fires at 10:00 local on ETA.
- **Cohort by ETA — one reminder per due-date, not per doc.** Reuse an existing cohort's `Reminder ID` if its ETA matches; only create a fresh reminder when no cohort exists for that date.
- **Always announce, never silently.** One short user-facing line for every reminder action (create / join cohort / title rewrite / complete). The user must know an Apple Reminder is being created on their behalf.

**Lifecycle (state machine):**

- **Flip to `requested`:** compute ETA → find-or-create cohort → write row with `ETA` + `Reminder ID` → announce.
- **Resolve to `have`:** if other cohort members remain → rewrite cohort title to drop this doc → clear `ETA` + `Reminder ID` on this row → announce. If last in cohort → mark reminder completed by id → clear → announce.
- **Re-stamp (still not arrived on re-check):** drop this doc from old cohort (rewrite or complete) → compute fresh ETA → find-or-create new cohort → update row → announce.

## RESUME mode (no-arg `/get-doc`)

1. Read `<memory>/journey.md`. Summarize standing grouped by status: `have`, `requested` (awaiting), `blocked`, `todo`. Group `requested` rows by cohort (shared `Reminder ID`).
2. For each cohort whose `ETA <= today` **or** whose Apple Reminder the user manually completed (osascript `completed` check by id), **auto-recheck every doc in the cohort without asking** — re-checking the user's own pending doc is not a scary action and the user has explicitly asked us not to nag (see [[feedback_approval_frequency]]). For each doc, use its **real delivery channel as defined in that doc's playbook** (`Collector/documents/<slug>.md`) — do NOT assume email. e.g. the IDF cert lives on the portal: re-open `ishurim.prat.idf.il` and read the (830) card badge (`הופק בהצלחה` → download; `ממתין להפקה` → still pending). If ready, fetch and flip to `have` (and run the Resolve-to-`have` lifecycle above); otherwise run the Re-stamp lifecycle.
3. For cohorts whose ETA is still in the future, just report them — don't probe.
4. Propose the next action — the oldest `blocked` or `todo` item — and, with the user's go-ahead, enter the normal 5-phase loop for that doc.
5. If the ledger is empty or missing, say so and ask the user which document to start with.

## Phases

### 1. SEARCH
First read `<memory>/journey.md` so you know this doc's current status and history. Then resolve `<doc>` to one of the files in `Collector/documents/`. Read that file in full. If a methods table exists, this is your menu. If no file exists, refuse — research first via the `knowledge-base` skill.

### 2. PLAN
Pick a method from the table. Default to the highest-confidence row with delivery=Immediate. Tell the user:
- Which method
- What you'll do (one line per step)
- Which steps are scary per [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) (downloads, submits, sending emails, bank/email nav) and need y/n consent

### 3. EXECUTE

**FIRST ACTION CHECKLIST — do this BEFORE any click/snapshot/anything else.** The single most common failure mode of this skill is silently driving Chrome in the background while the user can't see anything. The moment your first `goto()` lands on a real site (not `about:blank`), run BOTH:

1. ```js
   await state.page.bringToFront()   // focus the right tab inside Chrome
   ```
2. ```bash
   "${CLAUDE_PLUGIN_ROOT:-.}/skills/get-doc/scripts/split-screen.sh"   # editor left, browser right, browser focused (macOS only)
   ```

No "I'll do it after the snapshot." No "the user can see Chrome already." Do it on the first nav, every run. This overrides the playwriter "no bringToFront" default — get-doc flows are watched flows.

Then drive Chrome via the `playwriter` skill. Hard rules:
- **User owns login + CAPTCHA + OTP** per [ADR-009](../../docs/decisions/ADR-009-user-owns-login-and-captcha.md). Never type passwords or one-time codes; ask the user to do it in their browser.
- **Never proxy credentials** per [ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md).
- **Save every collected doc to `~/Downloads/RobinTax/`** (the user's collection folder). Create it with `mkdir -p ~/Downloads/RobinTax` on first use if missing — idempotent, safe to run every time. Name files `<slug>.<ext>` (e.g. `idf-discharge-certificate.pdf`). Record the absolute path in the ledger's `File` column.
- **Gating — batch consent at PLAN, don't nag (see [Gating model] below).** One go-ahead at PLAN covers the whole planned run (open site, log in, navigate, read, **download the user's own doc**). After the user says go, run the flow smoothly — do NOT re-prompt per step. Re-gate **only** a genuinely irreversible *external* action: sending an email, submitting a form to a gov body, or a payment. Downloading the user's own document is the goal, not a scary action — never gate it.
- After each playwriter action, snapshot and verify before the next step (observe→act→observe).
- If a step fails, **do not retry blindly**. Snapshot, diagnose, then either patch the step, try a different method from the table, or escalate to the user.

**Browser session mechanics** (do these so the user can actually watch + act):

- **Window split + focus** — covered above in the FIRST ACTION CHECKLIST. `split-screen.sh` defaults to `Code` + `Google Chrome`; override with `EDITOR_APP=… BROWSER_APP=… split-screen.sh`. macOS-only, needs Accessibility permission for the host (if windows don't move, that's why). Skip silently on non-macOS.

- **Tab reuse vs new tab** — within one run, reuse `state.page` (the tab you opened). Across runs (the session was started days ago), do NOT probe every playwriter session looking for a logged-in tab — profile cookies are shared, so just `context.newPage()` and `goto`. See [[feedback_dont_probe_playwriter_sessions]].

- **After navigating to any site that needs login, poll for the login to finish** instead of asking the user to type "done". Poll **every 3 seconds, cap at 5 minutes**, and stop automatically the moment a dashboard DOM signal appears (a text/element unique to the logged-in page — e.g. `הבקשות שלי` for the IDF portal). Run it in the background so you're notified on completion:
  ```bash
  i=0; until npx playwriter@latest -s <sid> -e 'let r=false;try{r=await state.page.evaluate(()=>document.body?.innerText?.includes("<DASHBOARD_TEXT>")||false)}catch(e){};console.log(r?"READY":"WAITING")' 2>&1 | grep -q READY; do i=$((i+1)); [ $i -ge 100 ] && { echo "TIMEOUT ~5min"; exit 1; }; sleep 3; done; echo "ON_DASHBOARD"
  ```
  (100 × 3s ≈ 5 min.) Tell the user to log in; the poll stops on its own.

### 4. REFLECT
After the run, write down honestly:
- Which method was used; which steps succeeded; which failed and how (literal error or unexpected state).
- Failures are **per-attempt**, not universal — annotate with date + outcome. A method that failed for this user may still work for others (different ת.ז.-registered address, different DOB-recall, etc.). Never delete a method from the table because one attempt failed.
- **Generalizable lessons** discovered in this run (a new tone rule, a new playwriter quirk, a new failure mode) — go to step 5b. **Existing** lessons that proved out or got refined — *update* the matching file in `lessons/` rather than creating a new one.

### 5. WRITE
Four destinations. Pick by **who needs the knowledge**:

**(a) Per-doc playbook** at `Collector/documents/<slug>.md` — facts about ONE document.
- Update the **Methods table** (see format below): bump confidence on success, add a per-attempt note on failure (never delete a row because one user failed).
- Overwrite the **Playbook** subsection for the method used with snippets that actually worked, sanitized.
- If a higher-fidelity `playwright codegen` recording exists at `Collector/documents/recordings/<domain>.recording.ts`, link to it from the playbook. Do NOT produce these recordings from `get-doc` runs — they require a sacrificial-Chromium codegen session at dev time per [Collector ADR-003](../../Collector/decisions/ADR-003-recording-via-playwright-codegen.md).

**(b) Generalizable lessons** at `.claude/skills/get-doc/lessons/<topic>.md` — guidelines that apply across documents (tone, gating habits, playwriter quirks, sanitization patterns). These ship with the repo, so users running a fresh clone get them too.

- **First time you discover a lesson:** create `lessons/<topic>.md` and add an entry under "Lessons" in this SKILL.md.
- **Subsequent runs:** if a run validates, contradicts, or refines an existing lesson, **edit the existing file** — don't create a new one. Add a date-stamped note inline ("Reconfirmed 2026-06-15: …" or "Edge case: …") so the lesson accretes evidence instead of fragmenting.
- Keep each lesson file short (one screen). Split into a second file only when a topic clearly diverges.

**(c) User-specific memory** at `~/.claude/projects/<project>/memory/` — ONLY when the lesson is a personal preference of *this* user (e.g. "this user prefers terser responses", "this user's accountant is X"). General best practices go in (b), not here.

**(d) Journey ledger** at `<memory>/journey.md` — **always**, at the end of every run that touched a doc. Update that doc's row: status (`todo → requested → have`, or `blocked` / `n/a`), `Updated` date, `File` path if saved (the absolute path under `~/Downloads/RobinTax/`), a one-line Next action, and — if the new status is `requested` — `ETA` + `Reminder ID` per the **Pending-doc reminders** section above. Run the reminder lifecycle (find-or-create / rewrite / complete) **as part of writing this row**, and announce every reminder action to the user. Add the row if this is the doc's first touch (accrete-as-you-go). Also refresh the *Collect documents* stage line, and stamp `Last updated: <date> by get-doc`. This is the cross-skill "where we stand" record per [ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md) — distinct from (c), which is durable *preferences*, not moving *status*. Sanitize it like any other written content.

> **Test for (b) vs (c)**: Would a different RobinTax user benefit from this lesson if they cloned the repo? If yes → repo lesson (b). If it's about this specific user's preferences, accounts, or history → memory (c).
> **(c) vs (d)**: (c) is stable facts/preferences about the user; (d) is the user's *current standing* (which docs are done/pending/blocked), which changes every run.

## Gating model

Refines [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) for this skill. The user wants to feel in control without being nagged — one approval, not a hundred.

- **One consent, at PLAN.** State the method + the steps + which (if any) are irreversible-external, and ask once. That go-ahead authorizes the whole planned run: opening the site, login, navigation, reading, and downloading the user's own document.
- **Run smoothly after go.** Do not stop to ask before each navigate/click/download. Narrate briefly (one line) but keep moving.
- **Re-gate only NEW irreversible external effects** not covered by the plan: sending an email on the user's behalf, submitting a form to a government body, a payment. Show the final artifact (e.g. the email draft) and let the user perform the irreversible click themselves.
- **Dev vs prod.** While developing/discovering a new flow it's fine to be chattier and check in. In the shipped happy-path flow, default to smooth — minimal interruptions. See [[feedback_approval_frequency]].

## Per-doc file format

```markdown
# <Document name> (<Hebrew name>)

**What it is**: one-line description.

## Methods

| Method | Confidence | Delivery | Auth | Cost | Last attempt |
|---|---|---|---|---|---|
| Self-service portal at X | high | immediate | OTP + DOB + parent name | free | 2026-05-27 ✓ |
| Email Y@... with proof | medium | days (async, manual) | none | free | 2026-05-27 ✓ (fallback) |
| In-person at לשכה | high | same day | photo ID | free | — |

> Confidence reflects general reliability, not user-specific success. A failure for one user (e.g. address mismatch) doesn't lower the row's confidence for everyone.

## Where to obtain
<existing research prose stays here>

## Playbook — <Method name>

**Last verified:** YYYY-MM-DD by claude run.

### Pre-reqs
- <e.g. logged into gov.il, target tab playwriter-attached>

### Steps
1. **Open the portal**
   ```js
   await state.page.goto('https://...', { waitUntil: 'domcontentloaded' })
   ```
2. **<next step>**
   ```js
   await state.page.getByRole('link', { name: /.../ }).click()
   ```

### Known fail modes (per-attempt, not universal)
- **2026-05-27 — user with current address outside council**: identity gate rejects after OTP. Workaround: switch to email-fallback method.

## Playbook — <Email fallback method>
<same shape as above>

## Caveats
- General quirks that apply regardless of method.
```

## Sanitization (before writing ANY playbook content to disk)

Scrub these from snippets, URLs, console output, and prose:

| Pattern | Replacement |
|---|---|
| 9-digit Israeli ID (`\b\d{9}\b` in context) | `<ID>` |
| Phone (`05\d-?\d{7}` / `+9725...`) | `<PHONE>` |
| Email addresses (user's, not service mailboxes like `ilant@rng.org.il`) | `<EMAIL>` |
| OTP codes (4–8 digits in OTP context) | `<OTP>` |
| Auth URL params (`code=`, `token=`, `state=`, `sid=`, session ids) | strip value |
| User's full name / first name when echoed by sites | `<NAME>` |
| DOB (any format) | `<DOB>` |
| Parent first names | `<PARENT>` |
| Home address + מיקוד | `<ADDRESS>` |

**Keep**: service mailboxes (e.g. `ilant@rng.org.il`), public council/portal URLs, generic ADR/section refs.

Quick check after writing: `grep -nE '\b\d{9}\b|05\d-?\d{7}|[\w.]+@(?!rng|piba|gov|taxes)' <file>` — should return nothing.

## When the run is over

Append a single-line update to the user with: method used, outcome, what was written, and the doc's new ledger status. No trailing summary of every step — they watched it.

## Lessons

Generalizable lessons learned from runs. Read these *before* PLAN if the doc involves email, OTP, or Gmail compose.

- [hebrew-email-tone](lessons/hebrew-email-tone.md) — how Hebrew correspondence on the user's behalf should sound.
- [email-delivered-docs-record-channel](lessons/email-delivered-docs-record-channel.md) — for docs that arrive as an async email reply, record the send channel (client/account/recipient/subject) at send time so re-check reopens the right inbox via playwriter instead of guessing or re-authing. Read before any email-send or re-check step.
- [pdf-download-methods](lessons/pdf-download-methods.md) — the three PDF-delivery shapes, the one capture method that works for all (response listener), per-site map, and what to try first on a new site. Read before any download step.
- [apple-reminders-cohorts](lessons/apple-reminders-cohorts.md) — osascript snippets, ETA math, title + announce templates for the Apple Reminders that back `requested`-doc ETAs. Read before any code path that flips a doc into or out of `requested`.

## Self-edit rule

If during a run you learn a lesson that applies to **this skill itself** (the loop, the gates, the file formats), edit this file directly. If the lesson is generalizable across documents but is *content* (not skill mechanics), write a new file under `lessons/` and add an entry to the index above. Then mention the change in your final message: "Updated SKILL.md / lessons/...". Keep SKILL.md under ~200 lines.
