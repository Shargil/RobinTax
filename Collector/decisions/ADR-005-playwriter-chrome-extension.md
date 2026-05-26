# ADR-005 (Collector): Drive the user's Chrome via the Playwriter extension over `chrome.debugger`

**Date:** 2026-05-26
**Status:** accepted
**Supersedes:** [ADR-001](./ADR-001-playwright-cdp-attach.md) — relaunching the user's Chrome with `--remote-debugging-port=9222`.

## Context

[ADR-001](./ADR-001-playwright-cdp-attach.md) chose to drive the user's Chrome by relaunching it with `--remote-debugging-port=9222 --user-data-dir=<their real profile>` and attaching via Playwright's `connectOverCDP`. The research scaffold at `research/collector.py` implements that approach.

Subsequent investigation documented at [`research/chrome-devtools-mcp-setup.md:28`](../research/chrome-devtools-mcp-setup.md) proved this no longer works on current Chrome:

> Since Chrome 136 (March 2025), `--remote-debugging-port` is silently ignored whenever `--user-data-dir` points at the default Chrome data directory. Security hardening — closes an attack where a local process could spawn a background Chrome attached to your real profile and exfiltrate cookies/passwords.

Every workaround was exhausted: graceful AppleScript quit + `--restore-last-session`, `--profile-directory=Default` to skip the profile picker, `--channel=beta`, longer port-wait timeouts. Chrome's own announcement at [developer.chrome.com/blog/remote-debugging-port](https://developer.chrome.com/blog/remote-debugging-port) confirms there's no flag combination that re-enables the old behavior on a default profile.

[Repo ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md) forbids credential proxying, so we still can't ship a flow that requires the user to re-log-in. That rules out Chrome for Testing (separate binary → fresh profile → loses the logged-in session) and anything that copies the profile.

That leaves three options for driving the user's real, signed-in Chrome:

1. The `chrome://inspect/#remote-debugging` toggle — user-driven, can't be scripted, friction on every session.
2. A Chrome extension using `chrome.debugger.attach()` + `chrome.debugger.sendCommand()`.
3. Building our own extension that does the same thing.

## Decision

**Drive Chrome via the Playwriter Chrome extension.** Playwriter ships an extension (Chrome Web Store ID `jfeammnjpkecdekppnclgkkffahnhfhe`) that calls `chrome.debugger` and exposes the connection over a local WebSocket relay on `127.0.0.1:19988`. Our Node MCP skill connects to that relay via `chromium.connectOverCDP("ws://127.0.0.1:19988")` and uses the standard Playwright API.

This means:
- User installs the Playwriter extension once (Chrome Web Store link surfaced in first-run onboarding).
- User clicks the extension icon on each target tab to grant attachment (icon turns green when attached).
- Our skill auto-spawns `npx playwriter serve --host 127.0.0.1` as a subprocess on first use, and shuts it down on disconnect.

## Why Playwriter over rolling our own extension

- **Already exists, tested, on the Chrome Web Store.** Building our own would mean writing a manifest-v3 extension + service worker + WebSocket bridge + CDP target/session multiplexing, then publishing to the Web Store and maintaining it. Substantial ongoing cost for the same end result.
- **Compatible with stock Playwright.** `chromium.connectOverCDP("ws://127.0.0.1:19988")` works out of the box; we don't depend on the `@xmorse/playwright-core` fork.
- **`isTrusted: true` events.** `chrome.debugger.sendCommand({}, 'Input.dispatchMouseEvent', ...)` enters Chrome's input pipeline at the compositor level — sites cannot distinguish it from a real mouse. See [`design/playwriter_internals.md`](../design/playwriter_internals.md).
- **Maintained.** Playwriter v0.2.0 published the same week we adopted it; the maintainer is active.

## Alternatives considered

- **Keep ADR-001 (relaunch with `--remote-debugging-port=9222`).** Rejected: empirically does not work on Chrome 136+ with the default profile. See `research/chrome-devtools-mcp-setup.md:28`.
- **`chrome://inspect/#remote-debugging` manual toggle.** Rejected: not scriptable; bad UX every session.
- **Chrome for Testing.** Rejected: separate binary, fresh profile, breaks the "user is already logged in" promise that the whole product rests on.
- **Roll our own Chrome extension.** Rejected for v1: substantial work + Web Store publication + maintenance. Revisit if Playwriter goes unmaintained or its security model degrades.
- **Copy the user's profile to a fresh `--user-data-dir`.** Rejected (already by ADR-001): stale snapshot, breaks 2FA cookies, doubles disk usage.

## Consequences

- Easier: zero credential handling on our side, `isTrusted` events out of the box, stock Playwright API, no Chrome restart needed.
- Harder: two one-time setup steps for the user (install extension + click icon per tab). Our skill needs to detect both and prompt cleanly. Subprocess management for the relay (spawn + healthcheck + shutdown).
- New dependency: a third-party Chrome extension on the Web Store. If Playwriter is unpublished or breaks, we'd have to fork the extension, ship our own, or accept degraded UX. Risk accepted for v1.
- Per-tab attachment: the user must click the extension icon on every tab we want to drive. This is also a feature — it's the consent gate that [Repo ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) would otherwise need to engineer.

## Related

- [ADR-001 (Collector)](./ADR-001-playwright-cdp-attach.md) — superseded by this ADR.
- [ADR-003 (Collector)](./ADR-003-recording-via-playwright-codegen.md) — recording approach. Codegen runs against a fresh Chromium and does not require the Playwriter extension.
- [Repo ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md) — forbids credential proxy / profile copy; constrains this decision.
- [`research/chrome-devtools-mcp-setup.md`](../research/chrome-devtools-mcp-setup.md) — empirical evidence that `--remote-debugging-port=9222` no longer works on the default profile.
- [Chrome 136 announcement](https://developer.chrome.com/blog/remote-debugging-port) — Chrome's own writeup of the change.
- [`design/playwriter_internals.md`](../design/playwriter_internals.md) — how the extension + relay work end-to-end.
- [`design/smart_replay_hld.md`](../design/smart_replay_hld.md) — v1 HLD.
