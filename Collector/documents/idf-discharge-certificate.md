# IDF Discharge Certificate (תעודת שחרור) / National-Civilian Service Completion

**What it is**: Proof of service completion — grants 1–2 credit points (נקודות זיכוי) per month for up to 36 months from the end of service.

## Methods

| Method | Confidence | Delivery | Auth | Cost | Last attempt |
|---|---|---|---|---|---|
| Self-service portal `ishurim.prat.idf.il` (form 830) | high | async — produced on portal, ~minutes to hours; poll | הזדהות לאומית SSO: ID + password + email OTP | free | 2026-05-29 ✓ (full download confirmed live; cert saved) |

> Confidence reflects general reliability, not user-specific success.

## Where to find it

- **IDF**: `https://ishurim.prat.idf.il/` — the "אתר האישורים" (certificates portal). The relevant document is exposed there as **"אישור על מהלך שירות צבאי" (form 830)** — functionally the same as the discharge certificate for tax-refund purposes. We did not see a separate "תעודת שחרור" item on this portal.
- **National service (שירות לאומי)**: Via the national service nonprofit that placed you.
- **Civilian service (שירות אזרחי)**: Via the placement organization.

## Acquisition shape — `ishurim.prat.idf.il`

The home page is the dashboard ("הבקשות שלי"). Each request appears as a **card** with a status badge and direct action icons (download / share / view). We don't have to drill into a detail tile — the download icon lives on the card.

**Possible states for a (830) card:**

| Badge | Meaning | Action |
|---|---|---|
| `הופק בהצלחה` (green) | Ready | Click download icon on the card → real binary download |
| `ממתין להפקה` (gray) | Submitted, not produced yet | `page.reload()` and retry — cap at ~10 min |
| (no card exists) | Nothing submitted | Submit new request (see below) — then poll |

**Multiple instances can coexist** — e.g. an older ready cert from a prior request plus a new pending one. The flow picks whichever (830) card has the ready badge; if only pending exists, polls; if none, submits.

**Cert validity** — certs carry a `תוקף עד` field (~1 month). Stale-but-still-on-portal certs may need orchestrator-level refresh logic later; flow-level just downloads what's available.

**Submission path** (when no card exists): click `להגשה` → click `שליחת בקשות (1)` inside `iframe[title="הגשת בקשה"]`.

**Auth**: "הזדהות לאומית" (National Identification SSO) → ID number (9 digits) + password → email-delivered OTP. No SMS, no Connect SSO redirect.

**Download mechanism**: the card's "הורדת קובץ PDF" link has **no `href`** — clicking it runs JS that fetches the PDF from an S3 bucket and hands the bytes to the browser as a **`blob:` URL** (`download` event fires). Two gotchas confirmed 2026-05-29:
- `download.saveAs` is broken through the Playwriter relay; and fetching the `blob:` URL afterward fails (`TypeError: Failed to fetch`) — the app **revokes the blob immediately**, so a stale URL from a prior click is dead.
- **Working capture**: arm a `page.on('response')` listener for `content-type: application/pdf` (the S3 GET, ~420 KB) *before* clicking, grab `await res.body()` in the handler, store the Buffer in `state`. Then write it out. The playwriter sandbox fs is **scoped** — it rejects `~/Downloads/...` with `EPERM: access outside allowed directories`. Write to `/tmp/<name>.pdf` inside the sandbox, then `mv` to `~/Downloads/RobinTax/` from a normal shell.

The portal's mention of "an email will be sent" is **only a notification trigger** — bytes always live on the portal.

See [`recordings/ishurim.prat.idf.il.recording.ts`](recordings/ishurim.prat.idf.il.recording.ts) for the sanitized click path.

## Playbook — Self-service portal (form 830)

**Last verified:** 2026-05-28 by claude run (dev codegen session; download path confirmed against a previously-issued cert).

### Pre-reqs
- User logged into `ishurim.prat.idf.il` in their own Chrome (הזדהות לאומית SSO — user types ID + password + email OTP themselves; ADR-009).
- Target tab playwriter-attached.

### Steps
1. **Open the requests dashboard** (the home page lists requests as cards under "הבקשות שלי").
   ```js
   await state.page.goto('https://ishurim.prat.idf.il/ords/r/hr/ishurim/בית', { waitUntil: 'domcontentloaded' })
   ```
2. **Branch on the (830) card's badge.** Multiple ready cards can coexist — pick `.first()` (newest, longest `תוקף עד`).
   - **`הופק בהצלחה` (green) → ready.** Arm a response listener, click the download link, capture the S3 PDF body, write to `/tmp`, then `mv` (see Download mechanism above). `download.saveAs` and post-click `blob:` fetch both fail through Playwriter ([[project_playwright_via_playwriter_relay_broken_apis]]).
     ```js
     // (a) arm BEFORE clicking
     state.pdf = null
     state.page.on('response', async (res) => {
       try { if ((res.headers()['content-type']||'').includes('pdf')) { const b = await res.body(); if (b?.length > 1000) state.pdf = b } } catch {}
     })
     // (b) click + wait
     await state.page.locator('role=link[name="הורדת קובץ PDF"]').first().click()
     await state.page.waitForTimeout(3500)
     // (c) write inside sandbox-allowed dir, then mv from shell
     require('node:fs').writeFileSync('/tmp/idf-cert.pdf', Buffer.from(state.pdf))
     ```
   - **`ממתין להפקה` (gray) → pending.** Poll: `await state.page.reload({ waitUntil: 'domcontentloaded' })` every ~10 minutes. Cap the in-session wait (it can take a while) — if still pending, leave the ledger row at `requested` and resume next day. Tell the user it may take a while and they can check tomorrow.
   - **No (830) card → submit a fresh request**, then poll as above.
     ```js
     await state.page.locator('.a-CardView-header').first().click()
     await state.page.getByRole('link', { name: 'להגשה' }).first().click()
     await state.page.locator('iframe[title="הגשת בקשה"]').contentFrame()
       .getByRole('button', { name: 'שליחת בקשות (1)' }).click()
     ```
3. **On success**, save the PDF and flip the ledger row to `have` with the file path.

### Known fail modes (per-attempt, not universal)
- **Multiple (830) cards coexist** — an older ready cert plus a new pending one. Pick the card whose badge is `הופק בהצלחה`; don't assume a single instance.
- **Stale-but-ready** — certs carry a `תוקף עד` (~1 month). A ready card may be expired; check the validity date before trusting it.

## Caveats
- Polling needs the user's logged-in Chrome attached — it can't run unattended across hours. State persists in the journey ledger (`requested`) so a later `/get-doc` resume re-checks.
