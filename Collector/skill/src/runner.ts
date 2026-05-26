// CLI wrapper around run-flow.ts. The MCP server (server.ts) uses the same
// underlying runner.
//
// Usage:
//   node --experimental-strip-types src/runner.ts <flow>
//
// Prereqs (one-time per session):
//   1. Playwriter relay running: `npm run relay`
//   2. Target tab open in user's Chrome + Playwriter icon clicked (green) on
//      that tab.

import { runFlow, FLOWS } from "./run-flow.ts";

const flowKey = process.argv[2];
if (!flowKey || !(flowKey in FLOWS)) {
  console.error("Usage: node --experimental-strip-types src/runner.ts <flow>");
  console.error(`Available flows: ${Object.keys(FLOWS).join(", ")}`);
  process.exit(1);
}

const result = await runFlow({ flowKey });
process.exit(result.status === "ok" ? 0 : 1);
