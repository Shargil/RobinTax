# RobinTax Chrome Extension — MVP design (106 collection)

## Context

RobinTax is a tool to help Israeli salaried employees (שכיר) recover tax refunds. The MVP scope is the smallest end-to-end loop: **collect the user's Form 106 (טופס 106) for the last 6 tax years (2020–2025)**. Everything else (other forms, refund calculation, filing) comes later.

The product form is a **Chrome extension** and the trust posture is **the extension assists the user inside their own ITA session; it never stores or proxies credentials** — both per [ADR-001](docs/decisions/ADR-001-chrome-extension-no-credential-proxy.md). These two constraints shape every design choice below.

This plan addresses **one open question only**: how the extension performs the browser actions needed to retrieve 106 forms from the ITA personal area at `https://secapp.taxes.gov.il/srsherutatzmi`, and how to make those actions look human / non-bot.

## MVP user flow (already decided with the user)

1. Dialog: *"היית שכיר מ-2020 עד 2025?"* — answers: כן / לא / לא יודע (תבדוק לי).
   - לא יודע → start with option 1 below as a probe.
2. Same dialog evolves into: *"בוא נמצא אותם:"*
   1. (Primary, recommended) **נסה באתר רשות המיסים** — מעסיקים מעלים אוטומטית.
   2. **חפש מעסקי עבר באימייל שלך ושלח בקשה ל-106.**
   3. **יש לי אותם, בוא נעלה אותם.**
3. Option 1 navigates to `https://secapp.taxes.gov.il/srsherutatzmi` and collects 106 forms for the 6 open years.

The design question is how step 3 actually runs.

## Approach

Three layers, each independently swappable:

1. **Targeting (how we know *where* to click):** memoized agentic with a resilience cascade. See "Targeting" below.
2. **Input primitive (how we *physically* click):** `chrome.debugger` + CDP `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent`. Only mechanism that emits `isTrusted=true`.
3. **Wrapper UX:** guided manual + passive network harvest. User is always the decision-maker; the debugger is used surgically, only after explicit per-session consent.

## Targeting — memoized agentic with resilience cascade

The flow for a typical שכיר is 30–50 steps and identical across users and years (modulo year parameter). Running an LLM agent per step per user is wasteful, slow, and a privacy problem. Instead:

- **AX-tree snapshot is primary.** For each step we record the target as an AX path: `role=button name="הגש"`. Misim.gov.il, MyGov, and Gmail web are all standard HTML with reasonable accessibility — the AX tree is the right primitive.
- **Annotated screenshot is the fallback** when the AX snapshot fails or the model expresses low confidence. Skip pure-vision entirely — it pays image-token cost for no benefit on these targets.
- **Resilience cascade per step.** Each step in the trace stores a fallback chain, tried in order:
  1. AX path (role + accessible name)
  2. `data-testid`
  3. Stable `id`
  4. Text content
  5. Bounding-box-relative position
- **Trace is the artifact.** Each step in the trace also stores its *intent* in plain Hebrew (e.g., "לחץ על שורת השנה 2023") — this doubles as the "explain what we're about to do" recipe shown to the user before each automated micro-loop.

### First-run / replay split

The first-run agentic capture happens **in dev, not in prod**:

- The developer runs the agentic loop once per flow on a test account. The resulting trace (intents + AX fallback chains) is committed to the repo and ships with the extension.
- Production users **only replay**. The extension never invokes an LLM during normal use.
- This means: **the user's ITA page content never leaves their machine by default.** No PII in LLM calls.

### Diff-point recovery in production

When replay fails (all fallbacks in a step's cascade miss), we are at a diff point — the site changed.

**Goal:** the user does not click anything they don't have to. The extension auto-recovers by calling an LLM, but with strict local redaction so personal tax data never leaves the machine.

**Recovery flow:**

1. Cascade fails on a step. Replay pauses.
2. Extension extracts the **failed step's local subtree** of the AX tree — the expected target's parent and siblings, *not* the whole page. Small, focused context.
3. Subtree passes through a **local redaction layer** before any network call:
   - **Regex tokenization** of values:
     - Shekel amounts → `<AMOUNT>`
     - Israeli ID (9 digits) → `<ID>`
     - Dates → `<DATE>`
     - Phone numbers, IBAN, account numbers → typed tokens
   - **Whitelist-keep** site chrome strings verbatim: a curated list of generic Hebrew UI labels (`"הגש"`, `"אישור"`, `"ביטול"`, `"הורד"`, `"הצג"`, `"פרטים"`, `"טופס"`, `"שנה"`, `"מעסיק"`, …) and 4-digit year numbers 2018–2030.
   - **Everything else** (free Hebrew text that isn't whitelisted) → replace with `<TEXT>` token. The structural slot is preserved so the model sees "there's a row label here" without seeing its contents.
4. Extension sends to the LLM: the redacted subtree + the trace's `intent` string for the failed step + the previous step's intent for context.
5. LLM returns a re-targeting suggestion (a new AX path within the subtree). Extension translates it back to a live element, executes the click, and updates the trace **locally** with the new fallback added to the cascade.
6. The unredacted AX tree, screenshots, and PDF contents never leave the user's machine.

**Sharing fixes back to dev:** if the recovery succeeded and the user opts in (explicit checkbox, not default), the extension can send the *redacted* before/after subtree to a developer-controlled endpoint so the next release ships an updated trace for all users. By default this is off.

### When to fall back to "show me what to click"

The auto-recovery is the default, but the extension falls back to asking the user to click manually if:
- The LLM returns low confidence.
- The LLM-chosen element fails to produce the expected `wait_for` outcome.
- Two consecutive recovery attempts on the same step fail.

In that case the overlay says *"הדף השתנה. הראה לי על מה ללחוץ."* — user clicks, extension learns locally.

### Trace storage format

A trace is a JSON file per flow, shipped with the extension under `traces/`. Schema sketch:

```json
{
  "flow": "ita-collect-106",
  "version": "2026-05-14",
  "steps": [
    {
      "intent": "פתח את אזור 'שע\"מ אישי'",
      "target": {
        "primary": { "role": "link", "name": "שע\"מ אישי" },
        "fallbacks": [
          { "kind": "testid", "value": "shaam-personal" },
          { "kind": "text", "value": "שע\"מ אישי" }
        ]
      },
      "action": "click",
      "wait_for": { "kind": "ax-name-appears", "name": "טופס 106" }
    }
  ]
}
```

Year-parameterized targets (e.g., "the row for year Y") use a template field; replay substitutes the year at runtime.

**`forEach` step type for variable cardinality.** A user might have 1 employer in 2020 and 4 in 2024. The trace handles this with a `forEach` primitive:

```json
{
  "intent": "הורד 106 לכל מעסיק בשנה הנוכחית",
  "kind": "forEach",
  "list_target": { "role": "row", "container_name_template": "טפסי 106 שנה ${year}" },
  "child_steps": [
    {
      "intent": "לחץ על כפתור ההורדה בשורה",
      "target": { "primary": { "role": "button", "name": "הורד" }, "fallbacks": [...] },
      "action": "click"
    }
  ]
}
```

Replay enumerates rows in the container at runtime and runs `child_steps` once per row. Survives any cardinality.

### Login completion signal

Replay does not start at a URL match — it starts when a known **post-login AX node** appears in the tab. The recording phase identifies a robust anchor (e.g., a heading containing the user's name, or a specific menu only present post-login) and stores it in the trace as `entry_wait`. The extension idles during login and 2FA, watches the AX tree, and only begins replay once the anchor is detected. URL changes during the login redirect chain do not trigger false starts.

### Open tension with [ADR-001](docs/decisions/ADR-001-chrome-extension-no-credential-proxy.md) (trust posture) and [ADR-004](docs/decisions/ADR-004-session-consent-and-debugger-lifecycle.md) (debugger lifecycle)

The yellow *"X started debugging this browser"* infobar that Chrome shows whenever `chrome.debugger.attach` is active is a deal-killer for naive consumer extensions — users panic, and for **tax filing** that panic is justified ("why is this thing debugging my tax account?"). The user flagged this directly when picking the approach.

**Mitigation strategy — re-frame the banner instead of hiding it:**

- Never attach the debugger silently. Before each attach, show our own clear UI: *"רובין-מס יבצע X פעולות עבורך. תראה התראה צהובה של Chrome — זה מאיתנו. אפשר לעצור בכל רגע."*
- Detach immediately when the automated micro-loop finishes. Don't keep the debugger attached idle.
- Default mode is **guided manual** (user clicks, we overlay highlights, we passively harvest PDFs from the network). The debugger only activates for explicitly opt-in "do the rest of this list for me" loops.
- The user must be able to abort with one click; doing so detaches the debugger and the banner disappears.

If this re-framing is not enough — i.e., user testing shows the banner still scares people away — the fallback is to drop to **guided manual + passive network harvest only** (no debugger). The architecture below keeps that option open: the debugger module is isolated behind a single `automate(steps)` function, removable without rewriting the rest.

### Behavioral layer (when the debugger is active)

User-supplied parameters — locked in:

- 80–250 ms jitter between actions. No fixed-interval rhythm.
- Typing: per-character key events with 60–180 ms inter-key delay and variance.
- After `input`, pause before firing `change` / `blur` — humans don't instantly defocus.
- Mouse paths via Bezier curve **only if** the target page tracks `mousemove` (rare on gov.il / Gmail — start without, add only if needed).
- Never automate login or CAPTCHA — those stay 100% on the user.
- Always run in the user's foreground tab. Never in a hidden tab or background window.

## Critical files to create (when we exit plan mode)

Folder: `RobinTax/Extension/` (at the repo root, alongside `CLAUDE.md`).

- `manifest.json` — Manifest V3. Permissions: `"scripting"`, `"storage"`, `"downloads"`, `"webRequest"`, `"debugger"`. Host permissions: `https://secapp.taxes.gov.il/*`.
- `background.js` — service worker. Hosts (a) the webRequest listener that captures 106 PDF responses and (b) the debugger controller (`attach` / `detach` / `dispatchInput`).
- `automation/cdp.js` — thin wrapper around `chrome.debugger.sendCommand` for `Input.dispatchMouseEvent` and `Input.dispatchKeyEvent`. Encapsulates the jitter / typing-cadence behavior. Single entry point: `automate(tabId, steps)`.
- `automation/replay.js` — trace player. Loads a JSON trace; for each step, resolves the target via the resilience cascade (AX path → testid → id → text → bbox); calls `automation/cdp.js` to execute the action; waits for the step's `wait_for`. On cascade failure, raises to the overlay to ask the user.
- `automation/ax.js` — helpers to resolve AX targets in the live page (via `chrome.debugger` `Accessibility.getFullAXTree` / `Accessibility.queryAXTree`).
- `automation/redact.js` — local PII redaction. Pure function: takes an AX subtree, returns a redacted copy with values tokenized (`<AMOUNT>`, `<ID>`, `<DATE>`, `<TEXT>`) and site-chrome whitelist kept verbatim. Unit-tested on synthetic ITA AX fixtures.
- `automation/recover.js` — diff-point recovery. Calls redact, POSTs the redacted subtree + intents to the RobinTax backend proxy (URL configured at build time), parses the response, updates the local trace with the new fallback. Falls over to "ask the user to click" after two failed attempts.
- `traces/ita-collect-106.json` — pre-recorded flow trace shipped with the extension. Captured in dev, not generated at runtime.
- `content/ita-overlay.js` — content script for the ITA site: renders the highlight ring + sidebar, drives the guided flow, shows per-attach consent before debugger attach, and shows the "show me where to click" UI when the cascade fails.
- `content/overlay.css` — overlay styles.
- `ui/onboarding.html` + `ui/onboarding.js` — the dialog: *"היית שכיר מ-2020 עד 2025?"* and the three collection options.
- `lib/years.js` — derives the 6 open tax years from today's date.
- `lib/storage.js` — collected PDFs stored as base64 blobs in `chrome.storage.local`, keyed by year and employer. Never uploaded.
- `lib/install-id.js` — generates and persists an opaque install-id (random UUID) on first run. Sole identifier sent to the backend proxy. No email, no account.
- `ui/viewer.html` + `ui/viewer.js` — in-extension PDF viewer. Lists collected forms by year, opens each PDF in a tab via blob URL. Export-to-disk button per form and "export all" button.
- `ui/done.html` + `ui/done.js` — terminal screen: "סיימנו. יש לך N טפסי 106." with a primary CTA "חישוב החזר המס שלך" that opens a coming-soon page in v1.
- `tools/record-trace/` — dev-only tool (not shipped). Runs the agentic capture: walks a flow on a developer's test account, calls the LLM at each step to determine the AX target, writes the trace JSON. Used to (re)generate files in `traces/`.

No existing code to reuse — the project has only docs so far.

## External dependency: RobinTax backend proxy

The extension calls a small RobinTax-controlled server for diff-point recovery. The server holds the Anthropic API key, proxies the call, can rate-limit per install (keyed by install-id), and lets us swap models without re-releasing the extension. This server is **out of scope for this plan** (it lives outside `RobinTax/extension/`) but the extension needs its URL baked in at build time and a simple POST contract:

```
POST /recover
Headers: X-RobinTax-Install-Id: <opaque-uuid>
Body: { trace_id, step_index, intent, prev_intent, redacted_subtree }
Response: { confidence: number, target: { role, name } | null, reasoning: string }
```

The server must guarantee it never logs raw request bodies and that redaction is verified server-side before forwarding to the model. Install-id is the only identifier; no email, no account.

## Out of scope for MVP

- Options 2 (email search) and 3 (manual upload) from the user's flow — these come *after* option 1 works end-to-end.
- Other forms (867, 161, 169א, etc.).
- The refund-estimate experience itself. v1 ships the terminal CTA that *points to* the estimate; the estimate is a separate v2 build.
- Filing.
- Any server-side component beyond the small diff-recovery proxy described above.
- User accounts, login, email capture.

## Verification (when implemented)

1. Load unpacked extension in Chrome.
2. Click the action button → onboarding dialog opens → answer "כן".
3. Choose option 1 → extension opens `https://secapp.taxes.gov.il/srsherutatzmi` in current tab.
4. User logs in (extension does nothing during login).
5. After login, sidebar appears showing 6 years to collect. Overlay highlights the first thing to click.
6. As user navigates, network listener captures any 106 PDF responses; sidebar updates "2020 ✓".
7. After all 6 years: sidebar shows a summary and a "save all to Downloads" button.
8. Manual test on a real ITA account — required, no fixture can substitute.
