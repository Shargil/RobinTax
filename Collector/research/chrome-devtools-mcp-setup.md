# Connecting Claude Code to your local running Chrome

How we got Claude Code to drive the same Chrome the user already had open (no second instance, no separate profile).

## What worked

- **MCP server:** [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp), spawned via `npx`.
- **Scope:** project-level [`.mcp.json`](../.mcp.json) at repo root (auto-loaded when Claude Code opens the repo).
- **Key flag:** `--autoConnect` — tells the MCP to attach to an already-running Chrome instead of launching its own.
- **One-time Chrome setup:** open `chrome://inspect/#remote-debugging` and tick **"Allow remote debugging for this browser instance"**. Chrome then starts a debug server on `127.0.0.1:9222`.
- **Restart Claude Code** once after editing `.mcp.json` so the MCP picks up the new args.

## Final `.mcp.json`

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--autoConnect"]
    }
  }
}
```

## Things we tried that did NOT work

- **Quit and relaunch Chrome with `--remote-debugging-port=9222 --user-data-dir="$HOME/Library/Application Support/Google/Chrome"`** — the big one. Chrome launches normally and the process shows the flag in its args, but the port never binds and `DevToolsActivePort` is never written. **Since Chrome 136 (March 2025), `--remote-debugging-port` is silently ignored whenever `--user-data-dir` points at the default Chrome data directory.** Security hardening — closes an attack where a local process could spawn a background Chrome attached to your real profile and exfiltrate cookies/passwords. No flag combination on the launch command re-enables this; the only way to drive your real, signed-in profile post-M136 is the `chrome://inspect/#remote-debugging` toggle documented above, the Playwright Extension (uses `chrome.debugger` extension API, not the port), or Chrome for Testing (separate binary that keeps the old behavior). See [the Chrome blog post](https://developer.chrome.com/blog/remote-debugging-port).
  - Adding `--profile-directory=Default` (to skip the profile picker that appears when `--user-data-dir` has multiple profiles) — picker is suppressed, but the M136 block still applies. The picker was a red herring.
  - Bumping the port-wait timeout from 15s to 30s — `DevToolsActivePort` never gets written at all, so no amount of waiting helps.
  - Graceful `osascript` quit before relaunch (so Chrome saves session-restore state) plus `--restore-last-session` — tab restoration worked, but didn't change the M136 outcome.
- `--browserUrl http://127.0.0.1:9222` alone — fine in theory, but the user's existing Chrome wasn't launched with `--remote-debugging-port=9222` and can't be enabled retroactively. MCP fell back to spawning its own Chrome.
- `--channel=beta` (from the Chrome team's blog post) — only works if Chrome Beta is installed. Without it the MCP errors with `Could not find DevToolsActivePort for chrome-beta`.
- Trying to enable remote debugging on an already-running Chrome via CLI flags — impossible; the `chrome://inspect/#remote-debugging` UI toggle is the only retroactive way.

## How we verified it attached to the real Chrome

- Called `list_pages` (via `new_page about:blank`) — response showed all the user's actual open tabs (Reddit, Gmail, Wikipedia, etc.), not a blank fresh profile.
- Subsequent `new_page`, `navigate_page`, `fill`, `click` calls operated on the same browser window the user could see.

## Caveats

- While remote debugging is on, **any local process can drive that Chrome** — read cookies, navigate, send keystrokes. Turn it off when not actively using the MCP.
- Gmail snapshot exceeded the tool's token limit; saved to a file and `grep`'d for the field uids instead of inlining the snapshot.
