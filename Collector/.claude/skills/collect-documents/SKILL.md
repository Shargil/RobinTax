---
name: collect-documents
description: Use proactively the moment a task involves fetching, downloading, or scraping a tax document (106, 867, pension statements, ITA outputs) from a site for the user's tax return. Drives the user's own Chrome via Playwright + CDP from the Collector service.
allowed-tools: Read, Write, Edit, Bash
---

# Collect Documents

## Goal

Pull the user's tax documents out of the sites that hold them into a local folder, without ever handling the user's credentials.

## When to use

- User asks to "get my 106 from <employer>", "download my pension statement", or similar.
- Adding a new site flow.
- Debugging an existing flow.

## Parameters

| Param | Meaning | Default |
|---|---|---|
| `site` | Which source (`ita`, `employer-michpal`, `bank-hapoalim`, …). Picks the flow file. | required |
| `year` | Tax year being collected. | current year − 1 |
| `out_dir` | Where downloaded files land. | `Users/<user>/<year>/<site>/` |
| `cdp_port` | Chrome remote-debug port. | `9222` |
| `chrome_profile` | Which Chrome profile to attach to (the user's real one). | `Default` |
| `timeout_ms` | Per-step timeout before fallback fires. | `15000` |

## Checklist

1. **Bootstrap CDP.** Check `cdp_port`. Open → `connectOverCDP`. Closed → relaunch the user's Chrome with `--remote-debugging-port=9222 --user-data-dir=<profile>`, wait for the port, then connect.
2. **Reuse the existing context** (`browser.contexts()[0]`). Never create a new context.
3. **Run `flows/<site>.py`** for the requested site + year.
4. **Save artifacts** to `out_dir` as `<doc-type>__<year>.pdf` plus a sibling `.meta.json` (`source_url`, `fetched_at`, `sha256`, `flow_version`).
5. **Write `out_dir/_run.json`** summarizing status, per-step timings, and any fallback rungs that fired.

## Fallback ladder (when codegen output breaks)

Cheapest first:

1. **Selector hardening.** `getByRole` → `getByLabel` → `getByText` → stable `data-*` → CSS. Never keep codegen's nth-child paths.
2. **Wait on content, not time.** `expect(locator).toBeVisible()` over `sleep`.
3. **Retry once** after `page.reload()` — catches most transient DOM swaps.
4. **Vision fallback.** Screenshot, ask an LLM "where is the *download 106* button?", click by returned bounding box. Slow + tokens — only after 1–3.
5. **Human-in-the-loop.** Pause, ask user to click, capture the selector via `page.on("click")`, write it back into the flow file. Next run is autonomous again.
6. **Hard fail.** Emit `flows/<site>.broken.md` describing what changed so a human can re-record. Never silently skip a document.

Rungs 1–3 are mandatory in every flow. 4–5 only for high-value documents.

## Examples

**Sample invocation:**

```python
from collector import collect
collect(site="employer-michpal", year=2024)
# → Users/<user>/2024/employer-michpal/106__2024.pdf  (+ .meta.json)
```

**Sample `flows/<site>.py`:**

```python
async def run(page, year, out_dir):
    await page.goto("https://example-employer-portal.co.il")
    await page.get_by_role("link", name="טפסי 106").click()         # rung 1
    year_row = page.get_by_role("row").filter(has_text=str(year))   # rung 1
    await year_row.get_by_role("button", name="הורד").click()        # rung 1
    download = await page.wait_for_event("download", timeout=15000) # rung 2
    await download.save_as(out_dir / f"106__{year}.pdf")
```

**Recording a new flow:**

```bash
playwright codegen --target python -o flows/<site>.py <site-url>
```

Then trim and replace brittle selectors per the fallback ladder.

## Anti-patterns

- **Never** launch a fresh Playwright browser (`chromium.launch` / `new_context`). Defeats the architecture — user gets logged out, sites flag the session.
- **Never** prompt the user for ITA / bank credentials. The whole point is we don't touch them.
- **Never** silently skip a document on failure. Always emit `flows/<site>.broken.md` and surface it.
- **Never** run headless. The user must see what we're doing in their own browser.
- **Never** put more than one site in a single flow file. One file per site = one diff per breakage.

## Related decisions

- [Collector ADR-001](../../../decisions/ADR-001-playwright-cdp-attach.md) — Why Playwright + CDP attach on port 9222.
- [Repo ADR-001](../../../../docs/decisions/ADR-001-no-credential-proxy.md) — credential-proxy trust posture.
