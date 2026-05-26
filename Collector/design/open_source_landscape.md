# Open Source Landscape — Browser Automation with LLM Fallback

Prior art survey conducted May 2026. This is the ecosystem we're building
on top of and the gap we're filling.

---

## The pattern has a name: Action Caching + LLM Fallback

Record deterministic XPath/selector sequences → replay without LLM →
fall back to LLM when DOM changes → write healed selector back to cache.

No single open source project implements all three of:
- Chrome extension (real logged-in browser, not headless)
- Pre-recorded action replay (zero LLM cost on cache hit)
- LLM fallback with cache healing

That gap is what Smart Replay fills.

---

## Projects by feature

### Playwriter (`remorses/playwriter`) ★ 3.3k
**What it does:** Chrome extension + CLI that connects to your real running
browser and lets agents execute Playwright code snippets via a CDP relay.

**Architecture:**
- Extension uses `chrome.debugger` API to attach to tabs
- Local WebSocket relay server on `:19988`
- MCP client connects to relay; extension forwards CDP commands
- Playwright fork (`@xmorse/playwright-core`) exposes `onMouseAction` hook
  and `Page.onMouseAction` callback — captures every click/move for recording
- `chrome.debugger.sendCommand(tabId, 'Input.dispatchMouseEvent', {...})`
  goes through Chrome's input pipeline → `isTrusted: true` on the event

**What it lacks:** No action caching or replay. Every run goes through LLM.

**Why we use it:** Solves the logged-in session problem. No fresh Chrome spawn,
no cookies lost, no automation detection banner.

**Repo:** https://github.com/remorses/playwriter

---

### HyperAgent (`hyperbrowserai/HyperAgent`)
**What it does:** Node.js library with built-in action caching and XPath replay.

**Key feature — action cache:**
```js
runFromActionCache(cache, { maxXPathRetries: 3 })
// tries XPath first → retries → LLM fallback
// step log shows fallbackUsed: false/true per step
```

**What it lacks:** Spawns its own headless browser — no logged-in sessions.

**Why it matters:** Best published implementation of the XPath-retry-then-LLM
pattern. The architectural gold standard for what we want.

**Repo:** https://github.com/hyperbrowserai/HyperAgent

---

### Stagehand (`browserbase/stagehand`) ★ active
**What it does:** Playwright wrapper with natural language control and
auto-caching of LLM-generated selectors.

**Key feature:** Once the AI figures out how to extract something, it exports
the static selector so subsequent runs skip the LLM entirely.

**What it lacks:** Spawns its own browser, no logged-in profile support.

**Repo:** https://github.com/browserbase/stagehand

---

### Passmark (`passmark.dev`)
**What it does:** Describe tests in plain English → AI executes once and
caches every action to Redis → subsequent runs replay at native Playwright
speed with zero LLM calls → self-heals when UI changes break cached steps.

**Most complete implementation** of the cache-first pattern, but not open
source and not a Chrome extension.

---

### BrowserBee (`parsaghaffari/browserbee`)
**What it does:** Privacy-first open source Chrome extension. LLM for
planning, Playwright for execution. Runs inside the browser so it can
interact with logged-in sites safely.

**What it lacks:** Macro/replay is listed as a planned feature (not yet built).

**Why it's interesting:** Cleanest codebase to fork if building a Chrome
extension with LLM integration. Macro replay is literally next on their roadmap.

**Repo:** https://github.com/parsaghaffari/browserbee

---

### Nanobrowser ★ ~8k
**What it does:** Open source AI web automation Chrome extension.
Session Replay (replaying historical tasks with minimal token consumption)
is on the roadmap.

**Repo:** search GitHub for `nanobrowser`

---

### Playwright MCP Bridge (Microsoft)
**What it does:** Chrome extension that bridges your existing logged-in Chrome
to an AI client (Claude, Cursor, etc.) via the MCP protocol.

**Architecture:** Same `chrome.debugger` + CDP approach as Playwriter.

**What it lacks:** No caching whatsoever. Every action goes through LLM
every time. Pure relay.

**Why it matters:** Proves the `chrome.debugger` → CDP path is mainstream
and supported by Microsoft.

---

### Anansi (`mdowis/anansi`)
**What it does:** Self-healing web scraper with CSS selector confidence
scoring stored in SQLite.

**Why it matters:** Best published confidence scoring formulas:
```
Success: score × 1.05 + 0.02  (cap 1.0)
Failure: score × 0.85 − 0.05  (floor 0.0)
Unused >7d: score × 0.99/day
Healing winner threshold: score ≥ 0.5
```
Healing strategy hierarchy: text-pattern match → fuzzy attribute match
(Levenshtein) → structural context → XPath fallback.

**Repo:** https://github.com/mdowis/anansi

---

## Feature matrix

| Project | Real logged-in Chrome | Action cache / replay | LLM fallback | Open source |
|---|---|---|---|---|
| **Smart Replay** (ours) | ✅ via Playwriter | ✅ | ✅ via Claude Code | ✅ |
| Playwriter | ✅ | ❌ | ✅ (via MCP client) | ✅ |
| HyperAgent | ❌ headless | ✅ XPath retry | ✅ | ✅ |
| Stagehand | ❌ headless | ✅ auto-cache | ✅ | ✅ |
| Passmark | ❌ headless | ✅ Redis cache | ✅ | ❌ |
| BrowserBee | ✅ extension | ⏳ planned | ✅ | ✅ |
| Nanobrowser | ✅ extension | ⏳ roadmap | ✅ | ✅ |
| Playwright MCP | ✅ extension | ❌ | via client | ✅ |
| Anansi | ❌ HTTP only | ✅ SQLite | ❌ | ✅ |

---

## How Playwriter CDP relay works (internals)

```
AI Agent
  ↓ Playwright API
Playwright fork (@xmorse/playwright-core)
  ↓ WebSocket to :19988/cdp/{id}
CDP Relay Server (Node.js, :19988)
  ↓ WebSocket to /extension
Chrome Extension (background.ts)
  ↓ chrome.debugger.sendCommand()
Chrome input pipeline → isTrusted: true click event
```

The extension's click mechanism:
```js
chrome.debugger.attach({ tabId }, "1.3", () => { /* now has CDP */ })

chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
  type: "mousePressed", x: 450, y: 320,
  button: "left", clickCount: 1
})
chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
  type: "mouseReleased", x: 450, y: 320,
  button: "left", clickCount: 1
})
```

`Input.dispatchMouseEvent` via CDP goes through Chrome's compositor-level
input pipeline — the same path as a physical mouse. The resulting DOM event
has `isTrusted: true`, indistinguishable from real user input.
