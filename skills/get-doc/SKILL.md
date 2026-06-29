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

00. **Consent gate (one-time per install, shown once).** Before any technical check, show the user exactly what they're authorizing — one consolidated ask, then run smoothly per the [Gating model] (don't re-ask per step). Present verbatim and gate Y/n:

    > **Before we start. Here's everything I'll do to get your documents. It all happens in front of you, in your own Chrome:**
    >
    > 1. **Open & click through websites.** I'll ask your permission about each site before I open it. You type your usernames and passwords. I never touch them.
    > 2. **Save to `~/Downloads/RobinTax/`.** A new folder under Downloads where I'll read and write your documents.
    > 3. **Bring Chrome to the front** so you can watch everything I do, side-by-side with this window.
    > 4. **Set Apple Reminders** so when a document takes days to arrive, you get a ping when it's ready.
    > 5. **One-time setup (first run only):** grant the permissions for the above so I don't ask again, and connect to your Chrome via the Playwriter browser bridge (you'll install one Chrome extension — I'll walk you through it).
    >
    > Allow all? [Y/n]

    On `n` → exit cleanly. On `Y` → proceed to the checks below. This is the broad consent; genuinely irreversible *external* effects (sending an email, submitting a gov form) are still gated per-action when they happen — see [Gating model].

0. **Grant collection permissions (auto — replaces the old manual `/permissions` step).** On the §00 `Y`, seed the sensitive collection perms into the user allowlist by running the bundled script:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT:-.}/hooks/seed-collect-perms.mjs"
   ```

   It merges (never clobbers) `Bash(npx playwriter@latest *)`, the `replay` MCP tool (both plugin-namespaced and dev variants), and `Write(~/Downloads/RobinTax/**)` into `~/.claude/settings.json`. **No more "go run `/permissions` yourself."** This single `node` call may itself prompt once — that's fine, it's immediately after the user's explicit §00 consent. (Open item: whether the seeded perms take effect this session or the next; if next, the first `npx playwriter` falls back to one native "allow always".)

1. **Setup doctor — show real state, never guess.** Run `"${CLAUDE_PLUGIN_ROOT:-.}/skills/get-doc/scripts/doctor.sh"` and relay its output. It prints each component's actual status + the exact next action for any ✗:
   - **Node** present? **Chrome** present?
   - **Relay** — the `smart-replay` MCP server auto-spawns the relay, but only *lazily on the first `replay` call*, and the Chrome extension needs it **already up** to connect. So the doctor **starts the relay now** (idempotent: probes port 19988, backgrounds `npx playwriter@latest serve --host 127.0.0.1` if down) *before* asking about the extension.
   - **Extension** installed + connected? If not, the doctor prints the one-time steps — install link, then **quit Chrome fully (Cmd-Q) and reopen** (Chrome registers the extension only after a full restart), then click the icon. The yellow "controlled by automated software" banner is expected.
   Never make the user interpret a green/red dot — the doctor states the next action in words.
2. Ensure `~/Downloads/RobinTax/` exists: `mkdir -p ~/Downloads/RobinTax`. Idempotent. <!-- CONSENT §00: file I/O location — if this path changes, update §00 bullet 2. -->
3. On subsequent runs (perms granted, extension paired, folder exists), the doctor comes back all-✓ and this whole preflight is silent.

Per [ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md): the user owns all logins. The skill never types passwords. If a site needs login, you log in in your own Chrome; the skill polls for the dashboard signal and resumes.

## The journey ledger

Before and after every run, this skill reads/writes the per-user journey ledger at `<memory>/journey.md` (`<memory>` = the per-user `~/.claude/projects/<project>/memory/` dir). It is the cross-skill source of truth for where the user stands. Governed by [ADR-011](../../docs/decisions/ADR-011-user-journey-ledger.md):
- **It is user data.** Sanitize the same way you sanitize playbooks (see Sanitization below) — slugs, statuses, dates, file paths, short notes only. Never IDs, OTPs, names, addresses, credentials.
- **Single writer at a time**: read it, modify only the rows/sections you own, write it back, and stamp `Last updated: <date> by get-doc`.
- Doc status state machine: `todo → requested → have`, with `blocked` / `n/a` as side states. `requested` = submitted, awaiting async delivery (e.g. an emailed PDF).
- Documents row columns: `Doc (slug) | Status | Updated | File | Next action | ETA | Reminder ID`. ETA + Reminder ID only set when status is `requested`; cleared on any other transition.
- **The ledger may arrive intake-seeded.** Per [ADR-013](../../docs/decisions/ADR-013-user-profile-and-intake.md), the `intake` skill seeds `todo` rows for the docs implied by the user's profile before this skill ever runs. No behavior change — operate on `todo` rows the same way whether they were intake-seeded or accreted on first touch. If a `todo` row references a slug that has no playbook in `Collector/documents/`, treat it as `blocked` with manual instructions rather than attempting to fetch.

## Pending-doc reminders (Apple Reminders)

<!-- CONSENT §00: OS integration (creates Apple Reminders) — if this is added/removed/changed, update §00 bullet 4. -->

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

**Warn before connecting (both paths, do this FIRST).** If the resolved doc file has a `## Login difficulty` section, relay it to the user **before the first connection** — before the first `goto` on the LLM path AND before invoking `replay` on the Smart Replay path. This is a heads-up, not a gate (no Y/N): the user should know a hard login is coming before the window pops up. Items the block flags as first-time-only, skip for users who've logged into that site before.

**First check Smart Replay.** Read [`Collector/skill/src/registry.ts`](../../Collector/skill/src/registry.ts)'s `DOC_TO_FLOW` map. If `<slug>` has an entry, **the plan is**: invoke the `mcp__smart-replay__replay` tool with `{site: <flow-key>}`. Announce in one line — *"Smart Replay flow exists for this doc — running it (no LLM)."* — and skip straight to EXECUTE. **Do not gate** with a Y/N prompt; the slash command itself is the consent (see [[feedback_approval_frequency]]). Don't ask the user to confirm a method when the cache is the method.

**Otherwise (no flow yet for this slug), pick a method from the table.** Default to the highest-confidence row with delivery=Immediate. Tell the user:
- Which method
- What you'll do (one line per step)
- Which steps are scary per [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) (downloads, submits, sending emails, bank/email nav) and need y/n consent

### 3. EXECUTE

**Precondition — preflight before replay (issue #4).** **Never invoke `mcp__smart-replay__replay` (or start any playwriter session) until the First-run preflight has completed for this install** — the §00 consent gate, §0 permission seed, and §1 setup doctor. If you cannot confirm the preflight ran this install (e.g. you jumped straight here from a slash command), run it first. Skipping it is exactly the bug where `replay` fired before the extension/relay were verified.

**Three-way decision tree.** Pick exactly one based on PLAN:

| If PLAN said… | Then EXECUTE… |
|---|---|
| Smart Replay flow exists for this slug | **Path A: Smart Replay** (cache hit) |
| No flow for this slug | **Path C: LLM-driven from scratch** (cache miss — start fresh playwriter session, navigate from the playbook) |

(Path B is the in-the-middle case: Path A failed and we're falling back — described inline below.)

---

**Path A — Smart Replay.** Invoke `mcp__smart-replay__replay` with `{site: <flow-key>}`. The MCP server auto-spawns the Playwriter relay on first call, **focuses the Chrome app + tab and runs `split-screen.sh` for you** (`bringToFrontAndSplit()` in `run-flow.ts` — happens before the first step so the user sees the flow start), then streams per-step status. On `isError: false` → success: the saved file list is in the tool result. Skip ahead to REFLECT/WRITE.

**On `isError: true` — classify before falling back.** Read the error message. Two cases:

1. **Precondition failure** (most common). Telltales: the error mentions a step name like `wait for post-login signal`, `wait for dashboard`, or any `waitFor` timeout; OR the user wasn't on the site when the flow started. This is NOT a flow defect — the flow couldn't see what it expected because the user wasn't ready. Recovery (no LLM hand-driving, no new playwriter sessions):
   - One-line announce: *"Smart Replay timed out at `<stepName>` — likely waiting on you. Bringing Chrome forward; please log in / complete the action you need to do."*
   - Force-focus Chrome via Bash: `osascript -e 'tell application "Google Chrome" to activate'`
   - Tell the user explicitly what to do (log in, dismiss popup, etc.) and that you'll retry once they're done. Wait for their "ok" / "done" — don't busy-loop.
   - **Re-invoke `mcp__smart-replay__replay` once.** The MCP holds nothing across calls and the user's tab state is now what the flow needs.
   - If THAT also fails → proceed to case 2 (Path B).

2. **Real flow defect** (selector throw, navigation error, anything that's not a wait-timeout). The cached flow is genuinely broken against the current DOM. This is **Path B — LLM-driven on the same live tab.** Announce *"Smart Replay step `<N>` failed: `<stepName>` — `<error>`. Falling back to LLM exploration on the live tab."* Then re-attach via the playwriter CLI to the same tab (the user's Chrome is intact — page wasn't closed) and resume from the current DOM. First action on resume: snapshot the page to learn where the broken flow left it. Don't `goto()` the start URL — the tab is already deep in the flow. **You do NOT need to re-run bringToFront + split-screen** — they already ran when the replay started.

The classify-before-fallback rule is load-bearing: skipping straight to LLM exploration on a precondition failure burns minutes loading the playwriter CLI skill, creating a new session, snapshotting to confirm what the retry would have confirmed anyway, then re-calling replay. Diagnose first, retry the cheap path once, only then escalate.

---

**Path C — LLM-driven from scratch (no flow exists for this slug).** This is the path for any doc that isn't in `DOC_TO_FLOW`. **Do NOT call `mcp__smart-replay__replay`** — there's nothing for it to run, and the tool will reject an unknown site key. Instead:

- Start a fresh playwriter CLI session (`npx playwriter@latest session new`).
- Open the site listed in the playbook's "Where to obtain" prose.
- Follow the FIRST ACTION CHECKLIST below (bringToFront + split-screen.sh) BEFORE the first click or snapshot.
- Hand-drive the flow per the LLM-driven rules below.
- On success, the WRITE phase will author a **candidate flow file** at `Collector/skill/src/flows/<domain>.candidate.ts` (§5(e)) and prompt the user to share it back via `contribute-flow` (§5(f)) — so this slow first run pays back as a fast cached run the next time.

---

**LLM-driven rules** (apply to both Path B and Path C). Drive Chrome via the `playwriter` skill. Hard rules below.

<!-- CONSENT §00: browser control (bringToFront + move/split the Chrome window) — if this changes, update §00 bullet 3. -->
**FIRST ACTION CHECKLIST — do this BEFORE any click/snapshot/anything else.** The single most common failure mode of this skill is silently driving Chrome in the background while the user can't see anything. The moment your first `goto()` lands on a real site (not `about:blank`), run BOTH:

1. ```js
   await state.page.bringToFront()   // focus the right tab inside Chrome
   ```
2. ```bash
   "${CLAUDE_PLUGIN_ROOT:-.}/skills/get-doc/scripts/split-screen.sh"   # editor left, browser right, browser focused (macOS only)
   ```

No "I'll do it after the snapshot." No "the user can see Chrome already." Do it on the first nav, every run. This overrides the playwriter "no bringToFront" default — get-doc flows are watched flows.

Hard rules for the LLM-driven path:
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

### 3b. SAME-SESSION OPPORTUNITIES (only after a successful fetch)

The portal you just authenticated into may host OTHER refund-relevant things reachable in the SAME session (e.g. the ITA אזור אישי holds prior-year refund status alongside the 106). Grabbing them now — still logged in — beats a second authenticated run.

1. Read the just-fetched doc's `## Same-session opportunities` section. Empty or absent → skip silently, go to REFLECT.
2. Fire ONE consolidated `AskUserQuestion` (mirrors §5(f) — not a per-item nag): *"You're still logged into `<site>` — want me to also `<opportunity>` while we're here?"* Multi-select if there's more than one.
3. On **yes** → pursue it in the live session (fetch the doc / read the screen), then record it in the journey ledger like any other touch.
4. **Intake linkage (load-bearing).** An opportunity may also be governed by an intake answer the user already gave (e.g. prior-year refund status ↔ the §6 FILING SCOPE years). If intake said **yes** to the linked item, a **no** here means "not in this session" — NOT "drop it": don't mark it `n/a`, let the linked follow-up proceed through its normal path (the Calculate stage for refund status), and still fire that document's own follow-up question. The convenience shortcut never overrides an explicit intake yes.

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

**(e) Candidate Smart Replay flow** at `Collector/skill/src/flows/<domain>.candidate.ts` — **only when the LLM-driven branch succeeded AND no canonical flow exists for this slug** (per [`Collector/skill/src/registry.ts`](../../Collector/skill/src/registry.ts), `DOC_TO_FLOW` has no entry). Mine the conversation for the playwriter calls that worked (skip exploration noise — failed snapshots, debug logs, etc.) and author a `run(page, deps)` function with each landing action wrapped in `step("name", fn)` per [Collector ADR-003](../../Collector/decisions/ADR-003-recording-via-playwright-codegen.md). Export `domain` and `intent`. Then route the file through [`Collector/skill/src/sanitize.ts`](../../Collector/skill/src/sanitize.ts)'s `sanitizeFlow()` — same rules as B2/D2 — and surface any warnings to the user in (f).

After writing the candidate, register it locally so this user's subsequent fetches of the same doc use the cache:
- Add an entry to `<memory>/local-flows.md` (create the file if missing) — one line per local flow: `- <slug> → <flow-key> at flows/<domain>.candidate.ts (LLM-discovered <date>)`.
- The next get-doc PLAN reads `<memory>/local-flows.md` AFTER reading the registry, so canonical flows always win but local candidates kick in for new sites.

**(f) End-of-run contribution prompt** — **only after writing (e)**. Fire one `AskUserQuestion`:
- **Question**: "You discovered a new clicking way to get this document! Want to help others in the community by removing personal data from the flow and sharing it (PR or email to Yam)?"
- **Header**: `Share flow`
- **Option 1 (default, picked on Enter)**: "Yes, sanitize and share (Recommended)" — walks through sanitization review, then opens a PR via `gh` if installed, else saves a local file with sharing instructions.
- **Option 2**: "No, keep it local only" — candidate stays at `flows/<domain>.candidate.ts` for this user only.

If the user picks "Yes" → invoke the `/robintax:contribute-flow <domain>` skill inline. If "No" → silent exit; the candidate flow still works locally for them.

> **Why an active question, not a passive nudge:** they just succeeded at the actual task (got their doc). That's the moment to ask — answer is fresh, friction is lowest. A passive "by the way, you could share this" line would be ignored.

## Gating model

Refines [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) for this skill. The user wants to feel in control without being nagged — one approval, not a hundred.

<!-- CONSENT §00: website navigation/clicking — per-site naming before opening is §00 bullet 1; if that policy changes, update §00. -->
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

## Login difficulty
<Heads-up the agent MUST relay before the first connection to this site (per §2 PLAN): what's hard about getting in — OTP latency, first-time identity-verification gauntlet, lockout-after-N-attempts, smart-card needs, etc. Flag first-time-only items so repeat users aren't over-warned. Omit the section entirely if login is trivial.>

## Same-session opportunities
<Adjacent refund-relevant things reachable in the SAME authenticated session as this doc's primary method. One bullet each: what it is, where in the portal, doc-vs-oracle-signal, and any **Intake-linked** item it maps to. Omit the section entirely if there are none. Consumed by §3b.>

## Caveats
- General quirks that apply regardless of method.
```

## Sanitization (before writing ANY playbook content to disk)

Scrub these from snippets, URLs, console output, and prose. The same table is enforced by [`Collector/skill/src/sanitize.ts`](../../Collector/skill/src/sanitize.ts) for Smart Replay flow files (auto-applied by the dev-only `record-flow` skill and the shipped `contribute-flow` skill).

| Pattern | Replacement | Notes |
|---|---|---|
| Employer tik (9-digit number after `תיק`/`תיק ניכויים`) | `<TIK>` | Scrub first — overlaps with the generic ID rule below. |
| 9-digit Israeli ID (`\b\d{9}\b` in context) | `<ID>` | Runs after tik so employer ids land in the more specific bucket. |
| Phone (`05\d-?\d{7}` / `+9725...`) | `<PHONE>` | |
| Email addresses (user's, not service mailboxes like `ilant@rng.org.il`) | `<EMAIL>` | |
| OTP codes (4–8 digits in OTP context, or any `.fill()` whose surrounding text matches `/(password|otp|code|סיסמה|אימות)/i`) | `<OTP>` / `<STRIPPED>` | |
| Auth URL params (`code=`, `token=`, `state=`, `sid=`, `session=`, session ids) | strip value | |
| User's full name / first name when echoed by sites OR appearing in selector text | `<NAME>` | Hard-fail in flow files — refuse to ship until the reviewer renames the selector. Names in selectors are the worst leak vector. |
| DOB (any format) | `<DOB>` | |
| Parent first names | `<PARENT>` | |
| Home address + מיקוד | `<ADDRESS>` | |
| High-entropy alphanumeric tokens (24+ chars) | flag, don't auto-replace | Likely session tokens or aria-refs; a human must check. |

**Keep**: service mailboxes (e.g. `ilant@rng.org.il`), public council/portal URLs, generic ADR/section refs.

Quick check after writing: `grep -nE '\b\d{9}\b|05\d-?\d{7}|[\w.]+@(?!rng|piba|gov|taxes|btl)' <file>` — should return nothing. For flow files specifically, `sanitize.ts`'s `leakCheck()` performs this check programmatically as the last gate before any PR/share.

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

**Consent-gate invariant.** If you add, remove, or change a user-visible system side effect — file I/O location, OS integration (Apple Reminders et al.), browser control, or a network send on the user's behalf — you MUST update the §00 consent gate to match. The side-effect sites are marked inline with `<!-- CONSENT §00: … -->`; keep those markers and the gate in sync.
