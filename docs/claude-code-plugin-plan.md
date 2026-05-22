# Claude Code plugin — deferred design

## Status

**Deferred.** Not building in v1. v1 ships the Chrome extension alone; diff-recovery in prod falls back to "הראה לי על מה ללחוץ" in the overlay; the developer captures and patches the ITA trace using a standalone Node script that calls the Anthropic SDK directly (no plugin).

This document captures the design we converged on so we can pick it up later when either (a) diff-recovery rate proves high enough to justify automation, or (b) the "RobinTax in Claude Code" pitch becomes an active GTM lever worth investing in.

## Why we'll eventually build this

GTM angle for tech-savvy users: install a Claude Code plugin → run `/robin-tax:start` → watch Claude narrate the tax-collection flow in the terminal, ask for one upfront consent, then reason through any diff points it encounters. The plugin is the LLM transport *and* the visible status surface. Same Chrome extension serves both audiences via a single `askLLM` seam (transport (a) = Claude Code plugin, transport (b) = remote LLM proxy for non-tech users).

## Architecture — Monitor + MCP + Extension

```
Chrome extension (owns the loop, the trace, the chrome.debugger input)
    │ HTTP POST :47821 (status / consent_request / recover_request)
    ▼
┌──────────────────────────────────────────────────────┐
│ robin-tax Monitor process (declared in monitors.json)│
│  - HTTP server on 127.0.0.1:47821                   │
│  - emits each event line to STDOUT                  │
│    → Claude sees it as a notification               │
│  - holds pending recover/consent answers keyed by   │
│    event_id; serves them via /result/{event_id}     │
└──────────────────────────────────────────────────────┘
                            ▲
                            │ loopback HTTP to /internal/respond,
                            │ authed by shared secret in
                            │ ${CLAUDE_PLUGIN_DATA}/internal.token
                            │
┌──────────────────────────────────────────────────────┐
│ robin-tax MCP server (stdio, plugin-declared)        │
│  - tool: submit_recovery(event_id, target, ...)      │
│  - tool: submit_consent(event_id, approved)          │
│  - tool: cancel(event_id, reason)                    │
└──────────────────────────────────────────────────────┘

Skill /robin-tax:start primes Claude:
"When you see ROBIN-TAX-EVENT lines from the monitor:
 - status → narrate one terse line, no invented reasoning
 - consent_request → ask the user, then submit_consent
 - recover_request → reason about redacted subtree, then submit_recovery"
```

Every piece is a documented Claude Code primitive: **Monitor** (background process, stdout → Claude notifications), **MCP server** (Claude's outbound responses), **Skill** (priming instructions). No `nohup`-from-hook hacks, no undocumented HTTP-MCP transport.

### Event payloads

```
status:           { kind: "status", text: "Clicked year 2023 — cached AX path" }
consent_request:  { kind: "consent_request", id, summary: "ok to drive Chrome through the RobinTax extension for this session?" }
recover_request:  { kind: "recover_request", id, intent: "<hebrew>", prev_intent: "<hebrew>", redacted_subtree: <ax-json> }
```

The redaction layer (regex tokens `<AMOUNT>`, `<ID>`, `<DATE>`, `<TEXT>` + site-chrome whitelist) is the same as in the extension's standalone v1 path. Surfacing redacted content in the user's terminal is a feature for tech users.

### One consent, one debugger attach

Exactly **one** `consent_request` per session, at the very start ("ok to drive Chrome through the RobinTax extension for this session?"). After the user approves it in the terminal, they move to Chrome and stay there for the rest of the session. The debugger attaches once and stays attached until the session ends or the user aborts. One warned-about yellow banner is calmer than many surprise banners.

Subsequent in-flow interactions (low-confidence recovery, "show me where to click") happen in the extension overlay, *not* in the terminal — the user is never yanked back from the browser.

### `askLLM` seam — the only transport-aware code

In `Extension/automation/llm.js`:

```js
export async function askLLM(intent, redactedSubtree, ctx) {
  if (await localBridge.isReachable()) {
    return localBridge.recover(intent, redactedSubtree, ctx);
  }
  if (remoteProxy.enabled) {           // v1.1+ remote proxy
    return remoteProxy.recover(intent, redactedSubtree, ctx);
  }
  return null;                         // caller falls back to overlay manual click
}
```

`recover.js` imports only `askLLM`. Status and consent events go through `bridge.emitStatus()` / `bridge.requestSessionConsent()` — single-seam, with `null`-returning no-ops if the bridge is unreachable.

## Pairing flow

**Bridge port: fixed at `47821`** (IANA dynamic/private range). Fixed because the extension can't read the terminal or disk — it needs a known target.

One-time per browser profile:

1. User installs the plugin: `claude plugins install ./robin-tax-plugin` (or marketplace).
2. Plugin's session-start Monitor opens `127.0.0.1:47821` and writes `~/.robin-tax/bridge.json` with `{ port: 47821, pairing_code }` (6 digits, valid for 10 min).
3. User runs `/robin-tax:start` in Claude Code. Skill prints the 6-digit code and the load-unpacked path.
4. Chrome → `chrome://extensions` → Load unpacked → `~/.claude/plugins/robin-tax/extension/`.
5. Extension's `ui/pair.html` opens; user pastes the 6-digit code.
6. Extension `POST http://127.0.0.1:47821/pair { code }` → bridge returns a persistent token; extension stores `{ token }` in `chrome.storage.local`.
7. Done. Future sessions: extension uses the fixed port + stored token; bridge re-issues the same token after restarts (token is plugin-scoped, not session-scoped, to survive Claude Code restarts).

### Plan B — port collision

If `47821` is in use when the plugin activates:

1. Bridge tries `47821 → 47822 → ... → 47830` on `EADDRINUSE`. Writes the chosen port to `~/.robin-tax/bridge.json` *and* prints it in the skill output as `port: 47823`.
2. Pairing UI accepts the code as `47823-482917` (port + code, dash-separated) when present. A bare `482917` is interpreted as port `47821`. Tolerant parser: trims spaces, accepts both formats.
3. If all 10 ports fail: clear error in the skill — *"RobinTax can't bind a localhost port (47821–47830 all busy). Quit other RobinTax instances or apps using those ports, then `/robin-tax:start` again."*

### User-facing messaging

- **Normal case:** *"Paste this code in the RobinTax pairing screen: **482917**. Load unpacked extension from: `~/.claude/plugins/robin-tax/extension/`"*
- **Fallback port:** *"Port 47821 was busy, using **47823** instead. Paste this: **47823-482917** (the dashed format includes the non-default port — paste it as-is)"*
- **No bridge reachable:** *"לא מצאתי את הגשר. ודא ש-Claude Code פתוח ושהרצת `/robin-tax:start`."*
- **Bad code:** *"קוד לא תקין או שפג תוקפו. הרץ שוב `/robin-tax:start` בטרמינל לקבל קוד חדש."*

## Files

Plugin (new — `robin-tax-plugin/` at repo root):

- `plugin.json` — manifest. Declares the MCP server, the skill, the Monitor, the bundled `extension/` dir, and the minimum Claude Code version (`>= 2.1.105`).
- `monitors/monitors.json` — declares the bridge as a Monitor with `name: "robin-tax-bridge"`, `command: "node ${CLAUDE_PLUGIN_ROOT}/bin/bridge.js"`, `when: "always"`.
- `bin/bridge.js` — long-running Node process. HTTP server on `127.0.0.1:47821`. Endpoints: `POST /pair`, `POST /event` (returns event_id immediately), `GET /result/{event_id}` (poll for answer), `POST /internal/respond` (loopback from MCP tools), `GET /health`. Emits stdout lines prefixed `ROBIN-TAX-EVENT:` for each event Claude should see.
- `mcp/server.js` — stdio MCP server. Tools: `submit_recovery`, `submit_consent`, `cancel`. Each tool reads the shared secret from `${CLAUDE_PLUGIN_DATA}/internal.token` and POSTs to `127.0.0.1:47821/internal/respond`.
- `skills/start.md` — `/robin-tax:start` skill. (a) Version-checks Claude Code, (b) reads `~/.robin-tax/bridge.json`, prints pairing code + load-unpacked path, (c) primes Claude with the event-response contract.
- `extension/` — the Chrome extension, bundled so one plugin install delivers both halves.

Extension additions (under `RobinTax/Extension/`, on top of the v1-standalone extension):

- `automation/llm.js` — the `askLLM` routing function.
- `automation/bridge.js` — localhost-bridge transport. `isReachable()` (pings `/health`), `recover()` (POST `/event` → poll `/result/{id}`), `emitStatus()`, `requestSessionConsent()`.
- `ui/pair.html` + `ui/pair.js` — 6-digit pairing screen with tolerant parser for `PORT-CODE` format.
- `lib/install-id.js` — opaque UUID, used as the rate-limit key for the remote-proxy transport (v1.1+).

Everything else (replay, redact, CDP, AX helpers, trace JSON, overlay, viewer, done screen, PDF storage, onboarding) already exists from the standalone extension build.

## Pre-build spikes (do these FIRST, before plugin code)

1. **Monitor stdout-to-Claude shape (~1 hour).** Smallest possible plugin: one Monitor that emits 3 lines, one Skill that prints "ready". Install locally, observe exactly how Claude reacts. Determines whether we use JSON-lines or terse prose, and how aggressive the skill needs to be to keep Claude responsive.
2. **Chrome debugger survival across ITA login navigations (~30 min).** Attach the debugger to a tab, walk through ITA login manually (SMS 2FA, MyGov OAuth redirects, etc.), confirm it stays attached. If not, "one upfront consent" is broken and we need re-attach logic.

These two are empirical unknowns that decide whether the architecture as designed works. The rest can be decided as we go.

## Open items (call out, don't block)

- **Token reuse across plugin reinstalls.** Token is plugin-scoped; uninstall + reinstall forces re-pair. Acceptable for v1.x; revisit if friction observed.
- **Multiple Chrome profiles.** Each profile pairs once. Document in `skills/start.md`.
- **Sharing fixes back to dev.** Opt-in upload of redacted before/after subtrees so the next release ships an updated trace. Design lands with v1.1's remote proxy.
- **LLM reliability in the loop.** Claude *might* miss a notification or narrate inconsistently. Mitigations: (a) `ROBIN-TAX-EVENT:` prefix on every line, (b) extension re-emits an event if no MCP-tool response in 10s, (c) skill priming is very explicit on the response contract.
- **Anthropic cost.** Tech users pay via their own Claude Code subscription. Documented in user-facing copy as a feature, not a bug.

## PRD entries to add when we pick this up

(Per project memory: I propose; the user pastes into `PRD.md`.)

```
5. Supersedes #3: RobinTax is one product — a Chrome extension that owns all automation logic. The Claude Code plugin is a transport for LLM compute and a visible status surface, not a separate product. Non-tech users get the same extension with a remote LLM proxy instead of the plugin. Why: avoids forking the automation logic across two products.

6. Responsibility split: the extension owns the trace, the click-path, chrome.debugger input, PDF capture, redaction, and storage. The Claude Code plugin owns LLM reasoning for diff-point recovery and the in-terminal status/consent surface. The extension never trusts the plugin with raw page content — only redacted AX subtrees cross the bridge. Why: one place for product logic, a clean seam for swapping LLM transports.

7. What the Claude Code user sees: one upfront consent in the terminal ("ok to drive Chrome through the RobinTax extension for this session?"), then a running terse status log, plus visible reasoning whenever the extension hits a diff point and asks Claude for a target. No per-step terminal prompts after the upfront consent. Why: earn the controller feel at real decision points; never yank the user back from the browser for prompts they'd autopilot through.

8. The Chrome debugger is attached once per session after the upfront consent, and detached when the session ends or the user aborts. Why: one warned-about yellow banner is calmer than many surprise banners.

9. The extension routes all LLM calls through a single `askLLM` function with pluggable transports: (a) local Claude Code via a localhost MCP bridge, (b) RobinTax's remote LLM proxy. Why: ship one transport at a time without rewriting recovery code.

10. Plugin↔extension pairing is a one-time 6-digit code shown by the `/robin-tax:start` skill; the token is plugin-scoped and survives Claude Code restarts. Why: standard plugin-host pattern, one-time setup, no background daemon.
```

## What we deliberately did NOT pick

- **Pre-attach consent per micro-loop** (the original PLAN.md mitigation). Replaced by one upfront session consent. Per-attach prompts train users to autopilot through them.
- **Always-on daemon installed by the plugin** (launchd/systemd). Bridge lives with Claude Code's plugin lifecycle. No background process the user didn't directly opt into.
- **`nohup`-from-hook to start the bridge.** Replaced by the Monitor surface, which is documented and managed by Claude Code itself.
- **Long-held HTTP requests** (extension's POST blocks until Claude answers). Replaced by `POST /event → GET /result/{id}` polling. Simpler retry/abort semantics.
