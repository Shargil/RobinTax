# Collector

Collects tax-refund documents from the user's logged-in sites (ITA, employer portals, banks, pension funds) by driving their own Chrome — reusing their existing session, never their credentials.

## Boundaries

- Runs inside the user's existing Chrome session — reuses their cookies, profile, and 2FA state.
- **Never** sees ITA credentials or banking fields ([ADR-001](../docs/decisions/ADR-001-no-credential-proxy.md)).

## Active design — Smart Replay

A Claude Code skill that replays pre-recorded click sequences per site (fast, zero-LLM on the happy path) and falls back to the LLM only when a site's DOM changes, healing the cache on every fallback. Built on Playwriter (real logged-in Chrome via `chrome.debugger` → CDP relay), not headless Playwright.

- [`design/smart_replay_hld.md`](design/smart_replay_hld.md) — high-level design (start here).
- [`design/confidence_scoring.md`](design/confidence_scoring.md) — selector confidence formulas, thresholds, decay.
- [`design/playwriter_internals.md`](design/playwriter_internals.md) — how the CDP relay and `chrome.debugger` attach work.
- [`design/open_source_landscape.md`](design/open_source_landscape.md) — prior-art survey and the gap Smart Replay fills.

Not yet implemented — these are design docs.

**`design/smart_replay_hld.md` is the source of truth for this service.** When behavior or architecture changes, update the HLD in the *same* change — never let code drift ahead of it. The diagram is `design/smart_replay_hld.svg`, hand-maintained — edit the SVG markup directly and keep it in step with the prose. Run the `collector-design-sync` skill on any such change.

## Available skills for this service

- `collector-design-sync` — keep `design/` (HLD + diagram) in sync when Collector behavior or architecture changes.

## Archived research

[`research/`](research/) holds the four earlier 106-collection approaches (Playwright+CDP scaffold, `chrome-devtools-mcp`, Claude-in-Chrome extension, Playwright MCP extension) and their raw captures. **None are implemented or maintained**; superseded by Smart Replay. See [`research/README.md`](research/README.md) for the quirks each one uncovered.

## Local decisions

- [ADR-001](decisions/ADR-001-playwright-cdp-attach.md) — Why attach to the user's existing Chrome over CDP rather than spawning a headless browser.
- [ADR-002](decisions/ADR-002-ui-clicking-default-xhr-fallback.md) — UI clicking is the default; XHR is a documented fallback for bulk pagination, summary-only UIs, and multi-doc endpoints.

## Repo decisions this service must honor

- [Repo ADR-001](../docs/decisions/ADR-001-no-credential-proxy.md) — never proxy ITA / banking credentials.
- [Repo ADR-009](../docs/decisions/ADR-009-user-owns-login-and-captcha.md) — user performs login + CAPTCHA; flows resume on a DOM signal, not a URL match.
- [Repo ADR-010](../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — every step needs a one-line `reason`; very scary actions (Chrome relaunch, bank/email nav, downloads) require y/n consent.
