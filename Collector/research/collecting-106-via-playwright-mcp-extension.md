# Collecting Form 106 via the Playwright MCP browser extension

Notes from driving the ITA "טפסי 106" page (`secapp.taxes.gov.il/sr-ezor-ishi/main/form106`)
with the **Playwright MCP extension** (the `mcp__playwright-extension__*` tools), which attaches to
a tab in the user's **own local Chrome** after they approve it in the extension's tab-picker.

This is a *third* access path, distinct from:

- the Playwright + CDP attach in [`flows/ita.py`](flows/ita.py) / [`collector.py`](collector.py),
- the `chrome-devtools-mcp` attach in [`chrome-devtools-mcp-setup.md`](chrome-devtools-mcp-setup.md),
- the Claude-in-Chrome extension in [`collecting-106-via-claude-in-chrome.md`](collecting-106-via-claude-in-chrome.md).

**Headline difference from the Claude-in-Chrome path:** here, network capture *works*, and it is the
whole game. We never needed the form's blob download to land on disk — we read the PDF straight out
of the XHR response and decoded it ourselves. The blob-download fight from the Claude-in-Chrome doc
simply does not apply.

## The page, as it actually is

- The 106 list is an SPA. Each year is a `<details>`/`<summary>` accordion; the year tile is a
  `summary` element, **not** an anchor. You **must click the year** to expand it before its
  per-employer 106 buttons exist in the DOM.
- Inside an expanded year, each employer row has a real `<button aria-label="להצגת טופס 106 שנת YYYY">`
  (the 106 itself) plus a `למסמך ריכוז הכנסות שנת YYYY` button (the consolidated-income summary).
  Multiple employers per year is normal (this account: 2024 and 2023 had 2 each).
- Expanding a year fires `POST https://secapp.taxes.gov.il/srCrmGeneralApi/api/form106/PostForm106GetTikNik`
  — this is the call that **lists the employers / `tikNik` (deductions-file numbers) for that year**.
  Use it to enumerate what to fetch, instead of scraping button refs out of the DOM.
- Clicking "להצגת טופס 106" then fires
  `POST https://secapp.taxes.gov.il/srCrmGeneralApi/api/getfileForm106` with body
  `{"tikNik":<deductions-file#>,"year":<YYYY>,"yeshut":null}`. The **response is `application/json`**
  (not a PDF) shaped `{"dataForm106":"<base64>"}` where the base64 decodes to `%PDF-1.5`. The page
  then turns that into a blob and `window.open`s it in a new tab.
- Years with no employer-reported form render the text **"לא נמצא מידע"** inside the expanded
  accordion and have no buttons. (This account: 2022 and 2021 were empty; 2025, 2024, 2023, 2020 had
  data.) Page also notes it only serves **2017 onward**.

## What worked

- **Session bootstrap:** `browser_tabs list` to see the approved tab → `browser_navigate` to
  `https://www.misim.gov.il/` → grab the `אזור אישי רשות המסים` link (it points at
  `https://secapp.taxes.gov.il/SrSherutAtzmi`, which redirects to the login page).
- **Detecting login without touching credentials (ADR-009):** after the user logs in, poll
  `browser_tabs list` and watch the tab URL flip to `/sr-ezor-ishi/main/main-page`. No need to read
  any OTP/ID field.
- **Big snapshots:** `browser_snapshot` on these pages blows the token limit. Use the `filename:`
  arg to dump the snapshot to a file, then `grep` it for the `[ref=eNNN]` you want. Year-tile refs
  stayed **stable** across expansions (handy); inner button refs are regenerated each expansion.
- **Clicking by ref:** `browser_click target=eNNN`. The "Ran Playwright code" echo (e.g. `.first()`
  / `.nth(1)`) is **cosmetic codegen** — targeting is by the ref you passed, so ignore the echo. We
  confirmed correctness by reading each request body's `year`/`tikNik`, not by trusting the echo.
- **Capturing the PDF (the key trick):** after each 106 click,
  `browser_network_requests filter="getfileForm106"` → take the **highest-numbered** entry →
  `browser_network_request index=N part=response-body filename=resp.json`, then decode `dataForm106`:

  ```python
  import json, base64
  d = json.load(open("resp.json"))
  open(f"106_{year}_{i}.pdf", "wb").write(base64.b64decode(d["dataForm106"]))
  ```

  Each file came out a valid 1-page `PDF 1.5`. Confirm year/employer per click with
  `part=request-body` (`{"tikNik":…,"year":…}`) so files are labelled correctly.

## Things that did NOT work / gotchas

- **Expecting a download in `~/Downloads`.** Clicking the 106 button produced **no file on disk** and
  (mostly) **no new tab** — from the controlled tab the click looks inert. The bytes only exist in the
  JSON XHR response. Don't wait on the filesystem; read the network response instead.
- **`browser_snapshot` without `filename:`.** Returns 50k+ chars and is rejected for exceeding the
  token limit. Always dump-to-file + grep on these ITA pages.
- **Trusting the echoed `.first()/.nth()` Playwright code** to know which year you hit. With several
  years expanded there are many matching buttons; verify via the request body's `year` field.
- **Stray blob tabs.** One click *did* spawn a `blob:https://secapp…` viewer tab (behaviour was
  inconsistent — most clicks spawned nothing). Close it with `browser_tabs close index=N`; it doesn't
  affect the capture since we read from the network, not the tab.
- **Reusing `flows/ita.py`'s mental model.** That flow assumes `expect_popup()` + a Download button in
  a popup iframe. Live behaviour is a JSON XHR + in-page blob, no viewer/Download button — revisit
  that flow against the real endpoint.

## Implications for the Collector flow

- The robust, headless-friendly implementation is **not** UI-download-driven. Once authenticated,
  for each year `2020…2025` (and back to 2017): call `PostForm106GetTikNik` to list that year's
  employers/`tikNik`, then for each call `getfileForm106` with `{tikNik, year}` and decode
  `dataForm106`. No UI clicking or blob download required at all.
- This sidesteps Chrome's multi-download "Allow?" prompt and the blob/tab-group problems entirely —
  the main reasons the Claude-in-Chrome path was fragile.

## Permissions (ADR-010)

Downloads are a gated action. We explained the flow and got explicit consent for the batch
("all six years, 2020–2025") before clicking anything, and paused at the login page per ADR-009.
