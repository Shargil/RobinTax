#!/usr/bin/env bash
# install_collect.sh — the ONE deterministic entry point for document collection.
#
# Owns everything machine-side; it NEVER prompts and NEVER explains. It does work
# and returns an exit code; the get-doc skill turns that code into the single human
# instruction that matters (install the extension, or nothing).
#
# Why this exists (the two bugs it kills):
#   1. The replay MCP tool used to die on a fresh install because Claude Code spawned
#      the MCP server at session start, BEFORE the deps-install hook had finished —
#      an unwinnable race. Here deps are installed SYNCHRONOUSLY before anything uses
#      them, so the race can't happen.
#   2. "multiple extensions (4003)" was self-inflicted: the relay got spawned from
#      three places at once (doctor.sh + the MCP server + manual). This script is now
#      the ONLY place that starts the relay.
#
# Subcommands:
#   prep          deps + exactly one relay. Silent.   exit 0 ok | 3 prep failed
#   check         real connect-check to the relay.    exit 0 connected (marker set)
#                                                      | 2 extension NOT attached
#                                                      | 3 relay unreachable
#   run <flow>    run the flow (assumes prep+check ok). exit 0 ok | 4 flow failed
#   setup         prep && check (convenience).         same codes as prep/check
#   paired?       has the extension ever paired here?  exit 0 yes | 1 no
#                 (lets the skill choose first-run framing WITHOUT running check)
#
# macOS-first; degrades elsewhere. Best-effort, idempotent, safe to run repeatedly.
set -u

RELAY_HOST=127.0.0.1
RELAY_PORT=19988
ROOT="${CLAUDE_PLUGIN_ROOT:-.}"
SKILL="$ROOT/Collector/skill"
MARKER_DIR="$HOME/.robintax"
MARKER="$MARKER_DIR/collect-paired"

# --- exit codes (keep in sync with the skill's EXECUTE table) ---
EXIT_OK=0
EXIT_NEED_EXTENSION=2
EXIT_PREP_FAILED=3
EXIT_FLOW_FAILED=4

# Bash /dev/tcp probe — no nc/lsof dependency.
port_open() { (exec 3<>"/dev/tcp/$RELAY_HOST/$RELAY_PORT") >/dev/null 2>&1 && exec 3>&- 3<&-; }

# ---------------------------------------------------------------------------
# prep — deps + one relay. Silent on success (one status line per action taken).
# ---------------------------------------------------------------------------
ensure_deps() {
  if [ -e "$SKILL/node_modules/playwright-core/package.json" ]; then
    return 0
  fi
  echo "  … installing collection dependencies (one-time)…"
  if ( cd "$SKILL" && npm install --no-audit --no-fund >/dev/null 2>&1 ); then
    return 0
  fi
  echo "  ✗ dependency install failed — run 'npm install' in $SKILL and retry." >&2
  return 1
}

ensure_relay() {
  if port_open; then
    return 0
  fi
  echo "  … starting the Playwriter relay…"
  nohup npx playwriter@latest serve --host "$RELAY_HOST" >/tmp/robintax-relay.log 2>&1 &
  for _ in $(seq 1 24); do port_open && break; sleep 0.5; done
  if port_open; then
    return 0
  fi
  echo "  ✗ relay failed to start — see /tmp/robintax-relay.log." >&2
  return 1
}

cmd_prep() {
  mkdir -p "$HOME/Downloads/RobinTax" 2>/dev/null || true
  ensure_deps  || return $EXIT_PREP_FAILED
  ensure_relay || return $EXIT_PREP_FAILED
  return $EXIT_OK
}

# ---------------------------------------------------------------------------
# check — a REAL connect to the relay (the honest replacement for the old grep).
#   port closed          → relay unreachable (prep failed)
#   connect throws        → extension not attached (needs the human click)
#   connect ok            → paired; write the marker
# ---------------------------------------------------------------------------
cmd_check() {
  if ! port_open; then
    echo "  ✗ relay not listening on $RELAY_PORT — run 'prep' first." >&2
    return $EXIT_PREP_FAILED
  fi
  local out
  out="$(cd "$SKILL" && node --input-type=module -e '
    import { chromium } from "playwright-core";
    const bail = setTimeout(() => { console.log("NOT_ATTACHED"); process.exit(0); }, 14000);
    try {
      const b = await chromium.connectOverCDP("http://127.0.0.1:'"$RELAY_PORT"'", { timeout: 12000 });
      let pages = 0;
      for (const c of b.contexts()) pages += c.pages().length;
      await b.close();
      console.log(pages > 0 ? "CONNECTED" : "CONNECTED_NO_TAB");
    } catch { console.log("NOT_ATTACHED"); }
    clearTimeout(bail);
    process.exit(0);
  ' 2>/dev/null | tail -1)"

  case "$out" in
    CONNECTED|CONNECTED_NO_TAB)
      mkdir -p "$MARKER_DIR" 2>/dev/null || true
      : > "$MARKER"
      return $EXIT_OK
      ;;
    *)
      return $EXIT_NEED_EXTENSION
      ;;
  esac
}

# ---------------------------------------------------------------------------
# run <flow> — deterministic happy path. Assumes prep + check already passed.
# ---------------------------------------------------------------------------
cmd_run() {
  local flow="${1:-}"
  if [ -z "$flow" ]; then
    echo "usage: install_collect.sh run <flow>" >&2
    return $EXIT_PREP_FAILED
  fi
  if node --experimental-strip-types "$SKILL/src/runner.ts" "$flow"; then
    return $EXIT_OK
  fi
  return $EXIT_FLOW_FAILED
}

# ---------------------------------------------------------------------------
main() {
  local sub="${1:-setup}"
  case "$sub" in
    prep)   cmd_prep ;;
    check)  cmd_check ;;
    run)    shift; cmd_run "${1:-}" ;;
    setup)  cmd_prep; local p=$?; [ $p -eq $EXIT_OK ] || return $p; cmd_check ;;
    paired?) [ -f "$MARKER" ] && return 0 || return 1 ;;
    *) echo "unknown subcommand: $sub" >&2; return $EXIT_PREP_FAILED ;;
  esac
}

main "$@"
