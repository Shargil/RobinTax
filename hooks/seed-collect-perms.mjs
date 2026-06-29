// First-collect seed — idempotently add the SENSITIVE collection permissions to the
// user-scope allowlist (~/.claude/settings.json). Unlike seed-perms.mjs (which the
// SessionStart hook runs silently for the plugin's own files), these are NOT seeded
// on install — they're written only AFTER the user passes the get-doc §00 consent
// gate, because they're more powerful (drive Chrome, run the replay MCP tool).
//
// Invoked by get-doc §0 on a "Yes" at the §00 consent gate:
//   node "${CLAUDE_PLUGIN_ROOT}/hooks/seed-collect-perms.mjs"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const home = homedir();
const settingsPath = join(home, ".claude", "settings.json");

const WANT = [
  "Bash(npx playwriter@latest *)",                 // drives the user's Chrome (the core flow)
  "Bash(npx playwriter *)",                          // version-pinned-out variant
  "mcp__plugin_robintax_smart-replay__replay",      // the replay MCP tool (plugin-namespaced, installed)
  "mcp__smart-replay__replay",                       // dev/.mcp.json variant of the same tool
  `Write(${home}/Downloads/RobinTax/**)`,           // saving collected docs
];

let settings = {};
try {
  settings = JSON.parse(readFileSync(settingsPath, "utf8"));
} catch {
  settings = {};
}

settings.permissions ??= {};
settings.permissions.allow ??= [];

const have = new Set(settings.permissions.allow);
let changed = false;
for (const p of WANT) {
  if (!have.has(p)) {
    settings.permissions.allow.push(p);
    changed = true;
  }
}

if (changed) {
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log("RobinTax: collection permissions granted.");
} else {
  console.log("RobinTax: collection permissions already granted.");
}
