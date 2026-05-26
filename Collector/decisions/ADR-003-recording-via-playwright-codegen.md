# ADR-003 (Collector): Record via `playwright codegen` (dev time), not a runtime auto-capture

**Date:** 2026-05-26
**Status:** accepted
**Supersedes:** the original Smart Replay HLD's claim that `onMouseAction` captures user clicks.

## Context

The original Smart Replay HLD described Phase 1 as a runtime developer-driven recording: a developer triggers `smart_replay.start_recording(site, intent)`, manually clicks through a flow, and Playwriter's `onMouseAction` hook captures each interaction with XPath / ariaRef / CSS selectors written to `actions/{site}.json`.

This design depended on `onMouseAction` firing for the user's physical clicks. Verification against the installed Playwriter v0.2.0 source (`@xmorse/playwright-core` `types.d.ts:984`; tests at `node_modules/playwriter/dist/on-mouse-action.test.js`) confirms the opposite: `onMouseAction` is a **pre-dispatch** hook that fires only when Playwright itself initiates a click — `page.mouse.click()` or `locator.click()`. Its actual purpose is to overlay ghost-cursor animations. There is no Playwriter export that captures user-driven physical clicks; the only "recording" Playwriter provides is **video** via `chrome.tabCapture`.

The HLD's claim was wrong. We had to pick a replacement.

## Decision

**Record at dev time with `playwright codegen`, then sanitize by hand and commit the result as a TypeScript flow module.** No runtime auto-capture in v1.

The recording ritual (lifted from `research/flows/ita.py:8-13`, which already validated this approach):

1. `npx playwright codegen https://<site>` on a fresh browser.
2. Log in inside codegen with a throwaway login if possible.
3. Walk the flow.
4. Sanitize the generated code:
   - Strip login (Repo ADR-009 — user performs login themselves at runtime).
   - Strip any captured credentials (Repo ADR-001).
   - Replace brittle `nth-child` selectors with `get_by_role` / `get_by_text`.
   - Replace `waitForTimeout` sleeps with content waits.
5. Wrap each action in `step("name", fn)` so failures point at the right place.
6. Commit as `Collector/skill/src/flows/{site}.ts`.

## Why

- **`onMouseAction` does not solve the problem.** It captures Playwright-initiated clicks, not user clicks. No fork patch we could ship would change this.
- **The alternative — injecting a DOM event listener** to capture user clicks — adds anti-bot detection surface (gov.il sites watch for unfamiliar listeners) and a credential-leak risk if we ever capture input events (see [`feedback_codegen_credentials`](../../.claude/projects/-Users-shargil-Documents--------------2026-05-14----------RobinTax/memory/feedback_codegen_credentials.md)). v1 prefers to ship without that surface.
- **Codegen is mature, free, and already in our toolchain.** The research scaffold proved the codegen-then-clean ritual works for ITA Form 106.
- **Dev-time recording is fine for v1.** v1 has one user and a handful of sites; per-site dev time is acceptable. The day we have many users authoring flows, revisit (see [`../backlog.md`](../backlog.md) "Remote update channel").

## Alternatives considered

- **Inject content script to capture user clicks.** Rejected: detection surface + credential-leak risk.
- **Hand-author flow modules without codegen.** Rejected: codegen accelerates the first draft; hand-authoring locators and waits is more error-prone.
- **Patch Playwriter to expose a user-click hook.** Rejected: requires forking and maintaining a fork; out of scope for v1.

## Consequences

- Easier: zero new code for recording; codegen does the heavy lift. No anti-bot detection surface added at runtime. Sanitization is mechanical and one-time per site.
- Harder: dev-time-only. We can't onboard a new site without a developer; this rules out user-self-record flows. Acceptable for v1.
- Tradeoff accepted: the codegen browser is not the user's logged-in Chrome, so the developer has to log in twice (once in codegen to record, then strip login from the output and let the runtime user log in their own Chrome).

## Related

- [ADR-004](./ADR-004-ts-flow-modules.md) — per-site TS flow modules format (this ADR's natural pair).
- [Repo ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md) — no credential proxy.
- [Repo ADR-009](../../docs/decisions/ADR-009-user-owns-login-and-captcha.md) — user performs login at runtime.
- [`design/smart_replay_hld.md`](../design/smart_replay_hld.md) — v1 HLD.
