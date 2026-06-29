#!/usr/bin/env bash
# get-doc setup doctor — prints the REAL state of each collection dependency and the
# exact next action for anything missing. Never makes the user interpret a green/red dot.
#
# Key job: the smart-replay MCP server auto-spawns the relay, but only LAZILY on the
# first replay call — yet the Chrome extension needs the relay ALREADY up to connect.
# So this doctor starts the relay *now*, before we ask the user about the extension.
#
# macOS-first; degrades gracefully elsewhere. Best-effort — the extension-connection
# probe is heuristic.
set -u

RELAY_HOST=127.0.0.1
RELAY_PORT=19988

ok()  { printf "  \xE2\x9C\x93 %s\n" "$1"; }   # ✓
bad() { printf "  \xE2\x9C\x97 %s\n" "$1"; }   # ✗

# Bash /dev/tcp port probe (no nc dependency).
port_open() { (exec 3<>"/dev/tcp/$RELAY_HOST/$RELAY_PORT") >/dev/null 2>&1 && exec 3>&- 3<&-; }

echo "RobinTax setup check:"

# --- Node ---
if command -v node >/dev/null 2>&1; then
  ok "Node $(node -v)"
else
  bad "Node not found — install from https://nodejs.org, then re-run."
fi

# --- Chrome ---
if [ -d "/Applications/Google Chrome.app" ] || command -v google-chrome >/dev/null 2>&1; then
  ok "Chrome installed"
else
  bad "Google Chrome not found — install it (RobinTax drives YOUR Chrome, your sessions)."
fi

# --- Relay (start it now if down) ---
if port_open; then
  ok "Playwriter relay up (port $RELAY_PORT)"
else
  echo "  … relay not running — starting it (the extension can't connect until it's up)…"
  nohup npx playwriter@latest serve --host "$RELAY_HOST" >/tmp/robintax-relay.log 2>&1 &
  for _ in $(seq 1 20); do port_open && break; sleep 0.5; done
  if port_open; then
    ok "Playwriter relay started (port $RELAY_PORT)"
  else
    bad "Relay failed to start — see /tmp/robintax-relay.log; try 'npx playwriter@latest serve' manually."
  fi
fi

# --- Chrome extension (heuristic connection probe) ---
echo "  … checking the Chrome extension…"
PW_OUT="$(npx playwriter@latest session new 2>&1 || true)"
if echo "$PW_OUT" | grep -qiE "session|attached|connected"; then
  ok "Chrome extension connected"
else
  bad "Chrome extension not connected. One-time setup:"
  echo "       1. Install: https://chromewebstore.google.com/detail/playwriter-mcp/jfeammnjpkecdekppnclgkkffahnhfhe"
  echo "       2. Quit Chrome FULLY (Cmd-Q) and reopen it — Chrome only registers the extension after a full restart."
  echo "       3. Click the Playwriter icon to attach. The yellow 'controlled by automated software' banner is expected — not an attack."
  echo "       Then re-run /robintax:get-doc."
fi
