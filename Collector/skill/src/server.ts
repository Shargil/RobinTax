// Smart Replay MCP server.
//
// Exposes one tool — `replay(site)` — that runs a pre-recorded flow against
// the user's logged-in Chrome via the Playwriter extension + relay. The
// flow's transcript and saved-file list are returned to Claude Code as the
// tool result.
//
// v1 scope: NO auto-spawn of the relay (user runs `npm run relay`
// separately), NO heal-back round-trip, NO session map. The replay tool
// is one-shot: it either completes or returns an error.
//
// Install (local dev):
//   claude mcp add smart-replay -- node --experimental-strip-types \
//     /path/to/Collector/skill/src/server.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { runFlow, FLOWS } from "./run-flow.ts";

const FLOW_KEYS = Object.keys(FLOWS);

const server = new Server(
  { name: "smart-replay", version: "0.0.1" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "replay",
      description: [
        "Collect tax-refund documents from a logged-in site by running its pre-recorded Playwright flow.",
        "",
        "Available sites:",
        "  - ita: Israel Tax Authority — Form 106 + ריכוז הכנסות (income summary) for up to 6 years back.",
        "  - btl: Bituach Leumi — annual unemployment compensation certificate (אישור שנתי על תשלום דמי אבטלה) per year.",
        "",
        "Prereqs (user-driven, one-time per session):",
        "  1. Playwriter Chrome extension installed (https://chromewebstore.google.com/detail/playwriter-mcp/jfeammnjpkecdekppnclgkkffahnhfhe).",
        "  2. Target tab open in the user's Chrome with the Playwriter extension icon clicked green.",
        "  3. Playwriter relay running: `npm run relay` in a separate terminal (the skill does not yet auto-spawn it).",
        "",
        "If the user isn't logged in to the target site, the flow waits up to 5 minutes for the post-login signal — they log in manually in the browser.",
        "Downloaded files land in Collector/skill/downloads/<site>/.",
      ].join("\n"),
      inputSchema: {
        type: "object",
        properties: {
          site: {
            type: "string",
            enum: FLOW_KEYS,
            description:
              "Which site flow to run. `ita` for Israel Tax Authority Form 106, `btl` for Bituach Leumi unemployment certificate.",
          },
        },
        required: ["site"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "replay") {
    return {
      content: [
        { type: "text", text: `Unknown tool: ${req.params.name}` },
      ],
      isError: true,
    };
  }

  const args = (req.params.arguments ?? {}) as { site?: string };
  const site = args.site;
  if (!site || !FLOW_KEYS.includes(site)) {
    return {
      content: [
        {
          type: "text",
          text: `Missing or invalid 'site'. Allowed: ${FLOW_KEYS.join(", ")}.`,
        },
      ],
      isError: true,
    };
  }

  const result = await runFlow({
    flowKey: site,
    // Mirror flow output to stderr for live visibility while the tool runs.
    // (stdout is reserved for MCP JSON-RPC framing — must not be touched.)
    log: (chunk) => process.stderr.write(chunk),
  });

  const summary =
    result.status === "ok"
      ? `\nSaved ${result.savedFiles.length} file(s) to ${result.outDir}:\n` +
        result.savedFiles.map((f) => `  · ${f}`).join("\n")
      : `\nFailed${result.error?.stepName ? ` at step "${result.error.stepName}"` : ""}: ${result.error?.message ?? "unknown error"}`;

  return {
    content: [
      {
        type: "text",
        text: result.transcript + "\n" + summary,
      },
    ],
    isError: result.status !== "ok",
  };
});

await server.connect(new StdioServerTransport());
// stderr only — stdout is the MCP wire.
process.stderr.write("smart-replay MCP server listening on stdio\n");
