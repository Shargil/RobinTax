#!/usr/bin/env bash
# SessionStart hook — make the smart-replay MCP server's deps resolvable.
#
# The server is ESM ("type":"module", bare `import`), so NODE_PATH does NOT help
# (it only affects CommonJS require). Instead we install into the persistent
# ${CLAUDE_PLUGIN_DATA} dir (survives plugin updates) and symlink that node_modules
# next to the server so normal ESM resolution finds it.
#
# Self-healing per the documented pattern: reinstall only when the manifest changed
# (or first run); if install fails, drop the marker so the next session retries.
set -u

ROOT="${CLAUDE_PLUGIN_ROOT:-.}"
DATA="${CLAUDE_PLUGIN_DATA:-$ROOT/.plugin-data}"
SKILL_PKG="$ROOT/Collector/skill/package.json"
SKILL_NM="$ROOT/Collector/skill/node_modules"

# Create the collection folder here, in the hook — NOT from a skill. Hooks run without
# per-call permission prompts, so the user never sees a "can I make this folder?" prompt
# right after the consent panel. (A skill's `mkdir ~/Downloads/RobinTax` would prompt,
# because a freshly-seeded allowlist entry doesn't take effect until the next session,
# and the literal `~` wouldn't match an absolute-path grant anyway.)
mkdir -p "$HOME/Downloads/RobinTax" 2>/dev/null || true

# Nothing more to do if the manifest isn't where we expect (e.g. layout changed).
[ -f "$SKILL_PKG" ] || exit 0

mkdir -p "$DATA"

# (Re)install into the persistent data dir only when the manifest differs (covers
# first run AND dependency-changing plugin updates).
if ! diff -q "$SKILL_PKG" "$DATA/package.json" >/dev/null 2>&1; then
  if cp "$SKILL_PKG" "$DATA/package.json" && npm --prefix "$DATA" install >/dev/null 2>&1; then
    :
  else
    rm -f "$DATA/package.json"   # leave marker absent so next session retries
    exit 0
  fi
fi

# Link the installed deps next to the ESM server. Dev mode (--plugin-dir .) often
# already has a real node_modules from a manual `npm install` — never clobber it.
if [ -L "$SKILL_NM" ] || [ ! -e "$SKILL_NM" ]; then
  ln -sfn "$DATA/node_modules" "$SKILL_NM"
fi

exit 0
