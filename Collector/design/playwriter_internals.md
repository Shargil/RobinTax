# Playwriter Internals — How CDP Relay Works

Reference for understanding what happens under the hood when Smart Replay
executes a click through the Playwriter extension.

---

## Three-tier architecture

```
┌─────────────────────┐   ┌───────────────────┐   ┌─────────────────┐
│      BROWSER        │   │    LOCALHOST       │   │   MCP CLIENT    │
│                     │   │                   │   │                 │
│  ┌───────────────┐  │   │  WebSocket Server  │   │  ┌───────────┐ │
│  │   Extension   │◄─┼──►│      :19988        │◄─►│  │ AI Agent  │ │
│  └──────┬────────┘  │   │                   │   │  └───────────┘ │
│         │           │   │   /extension       │   │                 │
│  chrome.debugger    │   │   /cdp/:id         │   │  Playwright API │
│         ▼           │   └───────────────────┘   └─────────────────┘
│  ┌──────────────┐  │
│  │  Tab (green) │  │
│  └──────────────┘  │
└─────────────────────┘
```

- Extension connects to `/extension` — receives CDP commands, sends responses
- MCP/CLI client connects to `/cdp/:id` — sends Playwright API calls
- Relay is a pure byte pipe, no logic

---

## How a click travels end to end

1. `page.click('#button')` — standard Playwright API call
2. Playwright serialises to CDP: `Input.dispatchMouseEvent`
3. → WebSocket to `:19988/cdp/{id}`
4. Relay forwards to `/extension`
5. `chrome.debugger.sendCommand(tabId, 'Input.dispatchMouseEvent', {...})`
6. Chrome compositor-level input pipeline
7. DOM event fires with `isTrusted: true`

---

## Why `isTrusted: true` matters

| Method | `isTrusted` | Detected by anti-bot? |
|---|---|---|
| `element.click()` from JS | `false` — synthetic event | Often yes |
| `Input.dispatchMouseEvent` via CDP | `true` — compositor-level | No |

`Input.dispatchMouseEvent` enters Chrome at the same layer as a physical
mouse. The page cannot distinguish it from a real user click.

---

## The extension's attach mechanism

```ts
// background.ts (extension)
chrome.debugger.attach({ tabId }, "1.3", () => {
  // extension now has full CDP access to this tab
})

// A click:
chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: 450, y: 320,
  button: "left",
  clickCount: 1
})
chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: 450, y: 320,
  button: "left",
  clickCount: 1
})
```

---

## Playwright fork

Playwriter maintains a fork of `playwright-core` as a git submodule
(`@xmorse/playwright-core`). Key additions vs upstream:

- `Page.onMouseAction` callback — a **pre-dispatch** hook invoked before
  Playwright sends `page.mouse.*` or `locator.click()` CDP commands. Its
  purpose is to overlay ghost-cursor animations or log Playwright-initiated
  actions. **It does NOT fire for the user's physical clicks** — the user's
  own mouse input goes through Chrome's normal input pipeline and never
  crosses Playwright's API surface. Capturing user clicks would require
  injecting a DOM event listener, which we deliberately don't do (see
  [ADR-003](../decisions/ADR-003-recording-via-playwright-codegen.md)).
- `Locator.selector()` — exposes the resolved selector string, used by
  tools like codegen.
- `BrowserContext.getExistingCDPSession()` — frame-level CDP access
  (targetId/sessionId) that upstream Playwright doesn't expose.

---

## Security model

- WebSocket server on `:19988` does **not** send CORS headers
  → only processes on localhost can connect, not web pages
- Extension only attaches to tabs where the user explicitly clicked
  the extension icon (green icon = controlled, gray = not)
- No remote connections unless the user explicitly sets up a traforo
  tunnel for remote control use cases

---

## Known quirks

- If all pages return `about:blank` → restart Chrome
  (Chrome bug in `chrome.debugger` API — hidden state that persists)
- Browser may switch to light mode on connect — Playwright sends an
  "emulate media" command on start via CDP
- Restarting the extension worker does not fix the `about:blank` bug
  (the state lives in Chrome, not the extension)

---

## Relevant source files

| File | Purpose |
|---|---|
| `extension/src/relayConnection.ts` | Extension → relay WebSocket client |
| `extension/src/types.ts` | `ExtensionState` Zustand store |
| `playwriter/src/cdp-relay.ts` | `startPlayWriterCDPRelayServer()` |
| `playwriter/src/mcp.ts` | MCP server + `execute` tool handler |
| `playwright/` | Forked playwright-core submodule |

Source: https://github.com/remorses/playwriter
