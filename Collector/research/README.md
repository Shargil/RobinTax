# Collector — archived research

Approaches we explored for driving the ITA 106 page from the user's own Chrome.
**None of these are implemented or maintained.** The active design is
[`../design/smart_replay_hld.md`](../design/smart_replay_hld.md) (Smart Replay).

Kept for the hard-won quirks documented in each — page structure, blob-download
behaviour, network-capture findings — which still inform the Smart Replay build.

## The four approaches

| File | Access path | Verdict |
|---|---|---|
| [`collector.py`](collector.py) + [`flows/ita.py`](flows/ita.py) | Playwright + CDP attach (`connectOverCDP`, port 9222) | MVP scaffold; superseded by Playwriter |
| [`chrome-devtools-mcp-setup.md`](chrome-devtools-mcp-setup.md) | `chrome-devtools-mcp --autoConnect` | `--remote-debugging-port` silently ignored post-Chrome-136 |
| [`collecting-106-via-claude-in-chrome.md`](collecting-106-via-claude-in-chrome.md) | Claude-in-Chrome extension | Blob `window.open` download lands outside the MCP tab group |
| [`collecting-106-via-playwright-mcp-extension.md`](collecting-106-via-playwright-mcp-extension.md) | Playwright MCP extension | Network capture works — form is base64 PDF in the `getfileForm106` JSON |

## raw-captures/

Raw outputs from those experiments: `resp-106-*.json` (base64-PDF XHR responses
from the ITA 106 endpoint) and `snap-*.md` (Playwright accessibility snapshots of
the page). Reference fixtures only.
