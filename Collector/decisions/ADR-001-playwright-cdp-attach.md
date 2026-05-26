# ADR-001 (Collector): Drive the user's Chrome via Playwright + CDP attach on port 9222

**Date:** 2026-05-22
**Status:** superseded by [ADR-005](./ADR-005-playwriter-chrome-extension.md) on 2026-05-26 — `--remote-debugging-port=9222` is silently ignored by Chrome 136+ when `--user-data-dir` points at the default profile (see [`research/chrome-devtools-mcp-setup.md:28`](../research/chrome-devtools-mcp-setup.md) and [Chrome's announcement](https://developer.chrome.com/blog/remote-debugging-port)). The Playwriter Chrome extension via `chrome.debugger` is the only API that can drive the user's signed-in profile.

## Context

Collector needs to drive the user's logged-in session on Israeli tax sites and partner portals to collect refund documents. We have to pick (a) the driver library, (b) how the driver reaches the user's browser, and (c) how the user's Chrome gets a remote-debug port without manual setup.

Repo-wide [ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md) forbids credential proxying, so whatever we pick must run in the user's own browser session.

## Decision

1. **Driver:** Playwright (Python).
2. **Connection:** `playwright.chromium.connectOverCDP("http://127.0.0.1:9222")` against the user's existing Chrome — never `chromium.launch()`.
3. **Port bootstrap:** check `9222` first; if open, attach silently. If closed, relaunch the user's Chrome with `--remote-debugging-port=9222 --user-data-dir=<their real profile>` and reconnect.
4. **Context:** reuse `browser.contexts()[0]`. Never create a new context.
5. **Mode:** headful only.

## Why

- **CDP attach over Playwright-launched browser.** A launched browser starts with an empty profile → user must re-login, and banks / ITA flag fresh-profile sessions. Attaching to the user's real Chrome reuses cookies, device fingerprint, 2FA state. Fewer bans, fewer logins.
- **Port auto-bootstrap over manual flag.** Asking the user to launch Chrome with a flag is a friction wall most users will hit. Checking the port first means we don't disturb their browser if it's already running our way.
- **Playwright over Puppeteer / Selenium.** `codegen` records flows fast, locator auto-waits cut flake, CDP attach is one line. Puppeteer doesn't have first-class Python; Selenium's auto-wait story is weaker.
- **Headful only.** We're driving the user's real session in front of them — headless hides failures from the user and looks more bot-like to anti-fraud systems.

## Alternatives considered

- **`chromium.launch()` with a copied profile** — rejected; copying the profile creates a stale snapshot, breaks 2FA cookies, doubles disk usage.
- **Have the user start Chrome with the debug flag themselves** — rejected; too much friction, forgotten between sessions.
- **A Chrome extension with `chrome.debugger`** — was the previous architecture, retired 2026-05-22 in favor of this approach for faster iteration and a smaller install footprint.

## Consequences

- Easier: zero install friction beyond `pip install playwright`; `codegen` shortens flow authoring; one Python file per site.
- Harder: any other Chrome window the user opens during a run shares the debug port — flows must be defensive about which tab/context they touch. Chrome must be restartable, which interrupts the user's open tabs the first time (mitigated by detecting an already-open debug port on subsequent runs).
- Tradeoff accepted: anti-bot systems can still detect CDP attachment via `navigator.webdriver` and CDP-specific JS hooks. We bet that reusing a real user profile outweighs the CDP signal for the sites we target. Revisit if we get blocked.

## Related

- [Repo ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md) — trust posture this decision must respect.
