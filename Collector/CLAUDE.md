# Collector

Collects tax-refund documents from the user's logged-in sites (ITA, employer portals, banks, pension funds) by driving their own Chrome — reusing their existing session, never their credentials.

## Boundaries

- Runs inside the user's existing Chrome session — reuses their cookies, profile, and 2FA state.
- **Never** sees ITA credentials or banking fields ([ADR-001](../docs/decisions/ADR-001-no-credential-proxy.md)).

## Smart Replay

A Claude Code skill that replays pre-recorded click sequences per site (fast, zero-LLM on the happy path) and falls back to the LLM only when a site's DOM changes. Built on Playwriter (real logged-in Chrome via `chrome.debugger` → CDP relay), not headless Playwright.

**v0 implemented** at [`skill/`](skill/) — MCP server (`smart-replay-skill`) exposing one tool, `replay(site)`, for `ita` (Form 106 + ריכוז הכנסות) and `btl` (unemployment certificate). Auto-spawns the Playwriter relay on first call and shuts it down on disconnect — users never run `npm run relay` manually. Shipped via [`/.claude-plugin/plugin.json`](../.claude-plugin/plugin.json)'s `mcpServers` field so plugin installs get it free. Doc-slug → flow-key registry at [`skill/src/registry.ts`](skill/src/registry.ts).

Get-doc consults this first (per [`skills/get-doc/SKILL.md`](../skills/get-doc/SKILL.md)) and only falls through to LLM exploration when no flow exists or replay throws. When LLM falls through, the user's Chrome tab is left intact so the LLM can re-attach via the playwriter CLI and resume from the live DOM.

Deferred to v1.5+: real heal-back round-trip (sessionId + `continue` tool + Edit-patch-in-place), numeric confidence scoring, DOM hash gate, multi-tier selector fallback.

- [`design/smart_replay_hld.md`](design/smart_replay_hld.md) — high-level design (start here).
- [`design/confidence_scoring.md`](design/confidence_scoring.md) — selector confidence formulas, thresholds, decay (v2 target).
- [`design/playwriter_internals.md`](design/playwriter_internals.md) — how the CDP relay and `chrome.debugger` attach work.
- [`design/open_source_landscape.md`](design/open_source_landscape.md) — prior-art survey and the gap Smart Replay fills.

**`design/smart_replay_hld.md` is the source of truth for this service.** When behavior or architecture changes, update the HLD in the *same* change — never let code drift ahead of it. The diagram is `design/smart_replay_hld.svg`, hand-maintained — edit the SVG markup directly and keep it in step with the prose. Run the `collector-design-sync` skill on any such change.

## Per-document research + playbooks

[`documents/`](documents/) holds one file per tax-refund document type. Each file has a Methods table (alternative ways to obtain the doc, with confidence + delivery) and prose research on where the doc lives. When a Smart Replay flow exists for the doc's primary method, the playbook section is a one-line pointer to [`skill/src/flows/<domain>.ts`](skill/src/flows/) (the flow file IS the executable spec). When no flow exists yet, the playbook may carry sanitized snippets discovered by get-doc's LLM exploration — these are candidates for graduation into a flow module.

[`documents/recordings/`](documents/recordings/) holds sanitized `.recording.ts` files produced via the `playwright codegen` ritual ([ADR-003](decisions/ADR-003-recording-via-playwright-codegen.md)) — higher-fidelity than playbook snippets, suitable for graduation into Smart Replay flow modules. One file per site, named `<domain>.recording.ts`. The dev-only [`record-flow`](../.claude/skills/record-flow/) skill automates the codegen → sanitize → flow-module pipeline.

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
