# Collecting Form 106 via the Claude-in-Chrome extension

Notes from driving the ITA "טפסי 106" page (`secapp.taxes.gov.il/sr-ezor-ishi/main/form106`)
with the **Claude-in-Chrome browser extension** (the `mcp__claude-in-chrome__*` tools), as
opposed to the Playwright+CDP flow in [`flows/ita.py`](flows/ita.py) or the
`chrome-devtools-mcp` attach in [`chrome-devtools-mcp-setup.md`](chrome-devtools-mcp-setup.md).

This is a separate access path with its own quirks — most importantly, the extension can only
see and act on tabs **inside its own MCP tab group**, which is what made downloads hard.

## The page, as it actually is

- The 106 forms list is an SPA. All years are rendered into the DOM **at once** as `<a>`
  elements — you do **not** need to expand each year's accordion to reach them.
- Each per-employer 106 is an `<a aria-label="להצגת טופס 106 שנת YYYY" href="javascript:void(0)">`;
  the year-summary doc is `<a aria-label="למסמך ריכוז הכנסות שנת YYYY">`. They are anchors, **not**
  `<button>`s — `document.querySelectorAll('button')` misses them.
- Label format is inconsistent across years: **2020–2025** use `…טופס 106 שנת YYYY`, while
  **2017–2019** use `…טופס 106 ל‍שנת YYYY` (extra "ל"). Match on a regex that tolerates both, or you
  silently skip the older years. In one account there were 18 links total (2 employers × 2017–2025).
- Clicking a 106 link runs a JS handler that fetches the PDF bytes and calls
  `window.open(blobUrl)` with a `blob:https://secapp.taxes.gov.il/…` URL — i.e. the form is built
  in-page and shown in a **new tab**.

## What worked

- **Session bootstrap:** `tabs_context_mcp` → `tabs_create_mcp` → `navigate` to
  `https://www.misim.gov.il/`, then into "אזור אישי רשות המסים". `screenshot` + `read_page filter=interactive` (which returns `ref_*` IDs) for orientation, then `computer left_click ref=…`.
- **Detecting login without seeing credentials (ADR-009):** poll `tabs_context_mcp` and watch the
  tab's URL flip from `/taxes-login/login/otp` to `/sr-ezor-ishi/main/main-page`. The URL/title in
  the tab context is enough; no need to read the OTP field.
- **Enumerating work in one shot:** `javascript_tool` over `document.querySelectorAll('a')` filtered
  by `aria-label` gave the full year/employer matrix in a single call — faster and more reliable than
  screenshotting and clicking accordion by accordion.
- **Forcing a real download (the key trick):** override `window.open` via `javascript_tool` so that
  when it receives a `blob:` URL it builds an `<a download>` element, clicks it, and returns `null`
  to **suppress the stray tab**. Set a `window.__dlName` global immediately before each link click so
  the override names each file. This keeps the whole flow inside the one tab the extension controls.

```js
// installed once on the page
window.open = function(u, ...rest){
  if (typeof u === 'string' && u.startsWith('blob:')) {
    const a = document.createElement('a');
    a.href = u; a.download = window.__dlName || ('form106_'+Date.now()+'.pdf');
    document.body.appendChild(a); a.click(); a.remove();
    return null;            // do NOT open the unreachable tab
  }
  return window.__origOpen.apply(window, [u, ...rest]);
};
```

## Things that did NOT work

- **Plain clicking the 106 link and expecting to drive the result.** The form opens in a brand-new
  tab/window that lands **outside the extension's MCP tab group**, so `tabs_context_mcp` never lists
  it and no `computer`/`read_page` call can touch it. From inside the controlling tab the click looks
  like it "did nothing": no navigation, no new tab, no console error.
- **`read_network_requests` to grab the PDF URL.** It returned "No network requests found" even after
  clicking — tracking only starts when the tool is first called, and the fetch that builds the blob
  didn't surface. Don't rely on it to recover the document endpoint here.
- **Navigating a controlled tab straight to the captured `blob:` URL.** A blob URL is scoped to the
  document that created it; it's useless from another tab. Capturing the URL only proves what's
  happening — you still have to download from within the originating page (hence the `window.open`
  override above).
- **Reusing the Playwright flow's mental model.** [`flows/ita.py`](flows/ita.py) assumes
  `page.expect_popup()` then a "Download" button inside the popup's iframe. What this session actually
  observed is `window.open(blobURL)` with no separate viewer/Download button — so that flow's
  popup+iframe assumption likely needs revisiting against the live page.

## Caveats / still-open

- **Verification gap.** The extension cannot see the user's Downloads folder, so "did the file land,
  and is it a valid 106?" can only be confirmed by the user. The override was observed to *fire*
  (filename + blob URL captured); end-to-end disk landing was **not** independently confirmed in this
  session.
- **Chrome's multi-download prompt.** Firing several downloads in a row triggers Chrome's
  "this site wants to download multiple files — Allow?" bar. If the user doesn't click **Allow**,
  every download after the first is silently dropped. Do them with a delay and/or warn the user.
- **Async timing.** The click → fetch → `window.open(blob)` chain is asynchronous; wait ~1–2s (or
  poll a capture array) before assuming the download fired.
- **Stray tabs from probing.** Each exploratory click before the override was installed spawned an
  uncloseable (by us) tab in the user's window. Install the override *first*, then click.
- **Permissions (ADR-010).** Downloads are a gated action — get explicit user consent before the
  batch, which the user gave for "all 106 forms, 2020–2025".
