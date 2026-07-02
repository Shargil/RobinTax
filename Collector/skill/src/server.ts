// Smart Replay MCP server.
//
// Exposes one tool — `replay(site)` — that runs a pre-recorded flow against
// the user's logged-in Chrome via the Playwriter extension + relay. The
// flow's transcript and saved-file list are returned to Claude Code as the
// tool result.
//
// Auto-spawns the Playwriter relay on first `replay` call (idempotent —
// checks port 19988 first) and kills it on process exit. No heal-back
// round-trip / session map in v1 — the replay tool is one-shot: it either
// completes or returns an error. On error, the user's Chrome tab is left
// in place so a follow-up LLM-driven flow can re-attach via the playwriter
// CLI and resume from the live DOM state.
//
// Install: bundled in the robintax plugin's mcpServers — no manual setup.
// For standalone dev:
//   claude mcp add smart-replay -- node --experimental-strip-types \
//     /path/to/Collector/skill/src/server.ts

import { spawn, type ChildProcess } from "node:child_process";
import * as net from "node:net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { runFlow, FLOWS } from "./run-flow.ts";

const RELAY_HOST = "127.0.0.1";
const RELAY_PORT = 19988;
const RELAY_READY_TIMEOUT_MS = 15_000;
const RELAY_POLL_INTERVAL_MS = 250;

let relayChild: ChildProcess | null = null;

function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
    socket.connect(port, host);
  });
}

async function waitForRelayReady(deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await isPortOpen(RELAY_HOST, RELAY_PORT)) return true;
    await new Promise((r) => setTimeout(r, RELAY_POLL_INTERVAL_MS));
  }
  return false;
}

async function ensureRelayRunning(): Promise<void> {
  if (await isPortOpen(RELAY_HOST, RELAY_PORT)) return;
  // The relay has a SINGLE owner: the get-doc skill's install_collect.sh.
  // The MCP server no longer spawns its own — the old multi-owner setup
  // (doctor.sh + this server + manual restarts all racing to bind :19988)
  // produced duplicate extension connections and the "4003 multiple
  // extensions" deadlock. If the relay isn't up by the time replay is called,
  // the preflight simply wasn't run.
  throw new Error(
    `Playwriter relay is not running on ${RELAY_HOST}:${RELAY_PORT}. ` +
      `Run the get-doc preflight first — install_collect.sh prep is the sole relay owner.`,
  );
}

function shutdownRelay(): void {
  if (relayChild && relayChild.pid && !relayChild.killed) {
    try {
      relayChild.kill("SIGTERM");
    } catch {
      // best-effort
    }
  }
}

process.on("exit", shutdownRelay);
process.on("SIGINT", () => {
  shutdownRelay();
  process.exit(130);
});
process.on("SIGTERM", () => {
  shutdownRelay();
  process.exit(143);
});

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
        "  3. Playwriter relay is auto-spawned on the first replay call (no manual start needed).",
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

  try {
    await ensureRelayRunning();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: msg }],
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
