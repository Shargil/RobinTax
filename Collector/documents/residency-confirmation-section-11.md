# Residency Confirmation — Beneficial Settlement / Section 11 (יישוב מזכה / סעיף 11)

**What it is**: Confirms 12 consecutive months of residency in an eligible settlement, granting a credit on income from personal effort (יגיעה אישית) at a rate that varies by settlement.

## Methods

| Method | Confidence | Delivery | Auth | Cost | Last attempt |
|---|---|---|---|---|---|
| Local council self-service portal | high (in general) | immediate | OTP + DOB + parent name + current address match | free | 2026-05-27 ✗ for user (gate failed) |
| Email council clerk with תמצית רישום proof | high | days (async, manual reply) | none | free | 2026-06-03 ✓ (cert received as reply) |
| Visit council in person | high | same day | photo ID | free | — |

> Confidence reflects general reliability, not user-specific success. The self-service portal rejecting one user (e.g. current address moved out of the council) doesn't lower the row's confidence for everyone else.

## Where to obtain

- **Local council / municipality** of the eligible settlement — issues a residency confirmation (אישור תושבות) signed by the local authority.
- **Israel Tax Authority (רשות המסים)** publishes the annual list of eligible settlements.
- For Eilat — separate regime under the Free Trade Zone Law (אזור סחר חופשי), Section 11, 10% credit.

## Playbook — Local council self-service portal (example: רמת הנגב)

**Last verified:** 2026-05-27 by claude run via playwriter. Council: **רמת הנגב** (`rng.org.il`).

### Pre-reqs
- User logged in to Chrome with the Playwriter extension attached to a tab.
- User's phone reachable for SMS OTP.

### Steps
1. **Open the council's forms hub.**
   ```js
   await state.page.goto('https://www.rng.org.il/', { waitUntil: 'domcontentloaded' })
   await state.page.getByRole('link', { name: /^טפסים$/ }).first().click()
   ```
2. **Click the residency request link** (under "בקשות לאישורי תושב").
   ```js
   await state.page.getByRole('link', { name: /בקשה לאישור תושב/ }).first().click()
   ```
3. **Click "לקבלת אישור תושב"** — opens the council's identity portal in the same tab.
   ```js
   await state.page.getByRole('link', { name: /לקבלת אישור תושב/ }).first().click()
   ```
4. **Fill ת.ז. + phone**, click אימות.
   ```js
   await state.page.locator('#taxid').fill('<ID>')
   await state.page.locator('#phone').fill('<PHONE>')
   await state.page.getByRole('button', { name: /אימות/ }).click()
   ```
5. **Ask the user to type the SMS OTP** on the resulting page (do not type it yourself per [ADR-009](../../docs/decisions/ADR-009-user-owns-login-and-captcha.md)).
6. **Identity gate** — site asks for DOB + parent first name. These match against משרד הפנים records. Ask the user; do not guess.
7. **Continue through contact-details + consent screens**, then download the cert.

### Known fail modes (per-attempt, not universal)
- **2026-05-27 — user's current registered address (ת.ז.) was no longer inside the council**: identity step returned "אחד או יותר מהפרטים שהוזנו אינו תואם את רישומינו" even with correct DOB + parent name. Switching method to email fallback worked.

## Playbook — Email council clerk with תמצית רישום proof

**Last verified:** 2026-05-27 by claude run via playwriter. Council: **רמת הנגב** (`ilant@rng.org.il`).

### Pre-reqs
- `תמצית רישום מורחבת` PDF in hand showing the historical registered address. To obtain it:
  1. Log in at `https://my.gov.il/` (national identification — user does this).
  2. Open the search box, choose "תמצית רישום" → opens documents page filtered.
  3. Click the row "תמצית רישום מורחבת" to expand. Click the Download (PDF) button.
  4. Note: `download.saveAs` is broken through the Playwriter relay (memory: [[project-playwright-via-playwriter-relay-broken-apis]]); ask the user to click Download themselves and tell you the path (default: `~/Downloads/<name>.pdf`).

### Steps
1. **Open Gmail compose pre-filled** (mailto-style URL works in the user's already-logged-in Gmail tab).
   ```js
   const to = '<clerk>@<council>.org.il'
   const subject = '<subject>'
   const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`
   state.page = await context.newPage()
   await state.page.goto(url, { waitUntil: 'domcontentloaded' })
   ```
2. **Type the body** (Gmail's contenteditable has TrustedHTML CSP — DON'T use `innerHTML`). Clear via Selection API + Backspace, then `keyboard.type` line by line with `Enter` between lines. Long Hebrew typing exceeds the 10-second exec timeout but completes in the background — just snapshot after.
3. **Attach the PDF**:
   ```js
   const fileInput = state.page.locator('input[type="file"]').first()
   await fileInput.setInputFiles('<absolute-path-to-pdf>')
   ```
4. **Show the user the final draft** and gate the Send click per [ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md). User clicks Send themselves.
5. **Record the send channel** (client/account, recipient, subject) in the ledger so the later re-check reopens the right inbox — see [[email-delivered-docs-record-channel]].

### Re-check (reply is async — days)
The cert comes back as a **reply in the same email thread**. Reopen that channel (the user's Gmail in Chrome) via `playwriter`, search the recipient (`ilant@rng.org.il`), open the conversation by its subject (`span.bog` — not the row/attachment, which opens a PDF preview), and count senders (`span.gD[email]`): only your sent message → no reply yet (stay `requested`); a message from `ilant@rng.org.il` → download the attached cert and flip to `have`.

**Re-check signal that worked (2026-06-03)**: the search-result row `gridcell` text contains a senders preview like `me, אילן 2` once the council replies (a single-sender thread shows just `me`). Cheaper than opening the conversation. Open the thread anyway to download the attachment.

**Download mechanics**: clicking Gmail's per-attachment Download button (`role=button[name="Download attachment <filename>"]`, snapshot gives an `id=":NN"` locator) triggers Chrome's native download to `~/Downloads/`. The `page.on('response')` listener does **not** capture it (the response goes through Chrome's downloader, not the page). Just `ls -lt ~/Downloads/` after the click and `mv` to `~/Downloads/RobinTax/<slug>.pdf`. See [[pdf-download-methods]].

**Turnaround**: request sent 2026-05-27 → cert received 2026-05-31 (4 days). Single-attachment reply (`שרגיל ים <year>.pdf`).

### Tone for the email
See [`.claude/skills/get-doc/lessons/hebrew-email-tone.md`](../../.claude/skills/get-doc/lessons/hebrew-email-tone.md). Short version: plain register, no em-dashes, no legal-section citations, attribute facts to source docs ("לפי תמצית הרישום...").

## Caveats

- **The 12-month requirement** is per the law's plain text — but the credit is then pro-rated to the number of days within each tax year that fall inside that consecutive period.
- **משרד הפנים registered dates** are the legal yardstick for סעיף 11, not the rental-contract dates. They can diverge by months (users update their address late). Rental contracts are useful backup if the council asks.
- **The eligible-settlement list** is updated annually — verify the year-specific list when claiming.
