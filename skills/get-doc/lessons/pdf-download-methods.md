# PDF download methods — what to use, and what to try first

How to pull a PDF off an Israeli gov/financial site through the user's Chrome (Playwriter relay).
There are three delivery shapes. **One capture method — the response listener — works for all three**, so
**try it first on any new site**. Reach for the others only when you already know the site's shape.

## Capture methods, in try-order

### 1. Response-listener capture (MOST ROBUST — default first try)
Arm `page.on('response', ...)` **before** clicking the download, then inspect what comes back. Covers every
shape below because it sees the raw bytes/JSON in flight, regardless of how the page wraps them afterward.

```js
state.pdf = null
state.page.on('response', async (res) => {
  try {
    const ct = (res.headers()['content-type'] || '').toLowerCase()
    if (ct.includes('pdf')) { const b = await res.body(); if (b?.length > 1000) state.pdf = b }      // binary
    else if (ct.includes('json')) {                                                                   // base64-in-JSON
      const t = await res.text(); const m = t.match(/JVBERi0[A-Za-z0-9+/=]+/)                          // JVBERi0 = "%PDF" b64
      if (m) state.pdf = Buffer.from(m[0], 'base64')
    }
  } catch {}
})
// then click the download control, waitForTimeout(~3500), and write state.pdf
```
Write with the sandbox fs to `/tmp/x.pdf` then `mv` to `~/Downloads/RobinTax/` — the sandbox fs is scoped
and `EPERM`s on `~/Downloads`. See [[playwright-via-playwriter-relay-broken-apis]].

### 2. `download.url()` → `page.evaluate(fetch)`  (only for STABLE server URLs)
If the download event gives a real `https://` URL (not a `blob:`), refetch it inside the page (cookies attach):
```js
const b64 = await state.page.evaluate(async (u) => { const r = await fetch(u, {credentials:'include'}); const a = await r.arrayBuffer(); return btoa(String.fromCharCode(...new Uint8Array(a))) }, download.url())
```
**Do not use on `blob:` URLs** — apps often revoke them instantly (`TypeError: Failed to fetch`).

### 3. `download.saveAs(path)` — **BROKEN through the relay.** Never use it. (ENOENT.)

### 4. Click + scrape `~/Downloads/` (for webmail attachments)
Some hosts — Gmail in particular — route attachment downloads through Chrome's **native downloader**, not the page's fetch. The `response` listener installed in method 1 captures **nothing** (only a `sync` JSON tick). Don't waste a call installing it; just:
```js
await state.page.locator('[id=":NN"]').click()   // role=button[name="Download attachment <filename>"]
```
…then, in bash, `ls -lt ~/Downloads/ | head -3` to find the freshly-landed file and `mv` it to `~/Downloads/RobinTax/<slug>.<ext>`. Verify with `file <path>` (expect "PDF document, version X.Y").

**Pitfall**: click the **Download** button (snapshot shows `role=button[name="Download attachment ..."]` with an `id=":NN"`), NOT the **Preview** link next to it — preview opens an in-tab PDF viewer and doesn't download.

## Per-site / per-shape map (what each site actually does)

| Site / doc | Shape | Use | Notes |
|---|---|---|---|
| **ITA** (`ita.gov.il`) — 106, tax confirmations | base64-in-JSON envelope (Pattern A) | method 1 (JSON branch) | frontend decodes to a `blob:` popup — unreachable from outside; grab the JSON in flight. Ref: `Collector/skill/src/flows/ita.gov.il.ts` |
| **BTL** (`btl.gov.il`) — unemployment etc. | real binary, `Content-Disposition: attachment`, stable URL (Pattern B) | method 1 (pdf branch), or method 2 | Ref: `Collector/skill/src/flows/btl.gov.il.ts` |
| **IDF** (`ishurim.prat.idf.il`) — form 830 | link has no `href`; JS fetches from S3 → wraps as `blob:` → **revokes immediately** (Pattern C) | method 1 (pdf branch) | confirmed 2026-05-29. method 2 fails here (blob revoked). |
| **Gmail** (`mail.google.com`) — email attachments | Chrome native downloader (Pattern D) — page `response` event does NOT fire | **method 4** | confirmed 2026-06-03 (RNG residency cert reply). Method 1 wastes a call here — go straight to click → `~/Downloads/` → `mv`. |

## Rule of thumb for a NEW site
1. **Webmail (Gmail / Outlook web) → method 4 directly.** The native downloader is the host's actual
   download mechanism; the page event never fires. Don't even arm the listener.
2. For gov / financial / SPA portals: arm the **response listener** (method 1) and click — it captures
   both binary and base64-JSON without knowing the shape in advance.
3. Only if nothing is captured AND the file didn't land in `~/Downloads/`, open DevTools Network on a
   manual click to identify the shape, then pick the matching branch. Identifying the shape: JSON body
   with a `JVBERi0...` string → Pattern A; `application/pdf` response → Pattern B/C.
4. Never reach for `download.saveAs`.

Related memory: [[pdf-acquisition-patterns-two-shapes]], [[playwright-via-playwriter-relay-broken-apis]].
