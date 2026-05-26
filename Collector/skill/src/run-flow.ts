// Importable flow runner — shared by the CLI (runner.ts) and the MCP
// server (server.ts).
//
// Two output modes:
//   - CLI mode (no `log` callback): writes to process.stdout as before.
//   - Captured mode (with `log` callback): all stdout writes are diverted to
//     the callback so the MCP's stdio JSON-RPC protocol on stdout isn't
//     corrupted by flow logging.

import * as path from "node:path";
import * as fs from "node:fs/promises";
import { chromium, type Page } from "playwright-core";
import { createStep } from "./step.ts";
import type { Flow, FlowDeps, StepError } from "./types.ts";

import * as itaFlow from "./flows/ita.gov.il.ts";
import * as btlFlow from "./flows/btl.gov.il.ts";

export const FLOWS: Record<string, Flow> = {
  ita: itaFlow,
  btl: btlFlow,
};

const CDP_URL = "http://127.0.0.1:19988";

export interface RunFlowOptions {
  flowKey: string;
  outDir?: string;
  /** If provided, all flow output is sent here instead of stdout. */
  log?: (chunk: string) => void;
}

export interface RunFlowResult {
  status: "ok" | "failed";
  flow: { domain: string; intent: string };
  outDir: string;
  savedFiles: string[];
  /** Full transcript of everything the flow wrote during the run. */
  transcript: string;
  error?: { stepName?: string; stepIndex?: number; message: string };
}

function pickPage(pages: Page[]): Page {
  const real = pages.find((p) => !p.url().startsWith("chrome-extension://"));
  return real ?? pages[0];
}

async function listPdfs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((e) => e.toLowerCase().endsWith(".pdf"));
  } catch {
    return [];
  }
}

export async function runFlow(
  options: RunFlowOptions,
): Promise<RunFlowResult> {
  const { flowKey, log } = options;
  if (!(flowKey in FLOWS)) {
    throw new Error(
      `Unknown flow: ${flowKey}. Available: ${Object.keys(FLOWS).join(", ")}`,
    );
  }
  const flow = FLOWS[flowKey];
  const outDir = options.outDir ?? path.resolve("downloads", flowKey);

  const transcript: string[] = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);

  const emit = (chunk: string) => {
    transcript.push(chunk);
    if (log) {
      log(chunk);
    } else {
      originalStdoutWrite(chunk);
    }
  };

  // In captured mode, redirect ALL process.stdout writes — covers the flows'
  // console.log calls and step.ts's process.stdout.write directly.
  if (log) {
    process.stdout.write = ((
      chunk: string | Uint8Array,
      ...rest: unknown[]
    ): boolean => {
      const text =
        typeof chunk === "string"
          ? chunk
          : Buffer.from(chunk).toString("utf8");
      transcript.push(text);
      log(text);
      // Honor the stream API's optional trailing callback.
      const cb = rest[rest.length - 1];
      if (typeof cb === "function") (cb as () => void)();
      return true;
    }) as typeof process.stdout.write;
  }

  emit(`→ Connecting to Playwriter relay at ${CDP_URL}\n`);

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (err) {
    if (log) process.stdout.write = originalStdoutWrite;
    return {
      status: "failed",
      flow: { domain: flow.domain, intent: flow.intent },
      outDir,
      savedFiles: [],
      transcript: transcript.join(""),
      error: {
        message: `Cannot reach Playwriter relay at ${CDP_URL}. Is the relay running? Start it in a separate terminal with: npm run relay`,
      },
    };
  }

  try {
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error(
        "No browser contexts visible. Click the Playwriter extension icon on the target tab (icon should turn green).",
      );
    }
    const ctx = contexts[0];
    const pages = ctx.pages();
    if (pages.length === 0) {
      throw new Error(
        "Context has no pages. Open a tab and click the Playwriter icon.",
      );
    }
    const page = pickPage(pages);
    emit(`→ Attached to: ${page.url()}\n`);
    emit(`→ Running flow: ${flow.domain} — ${flow.intent}\n`);
    emit(`→ Output dir: ${outDir}\n\n`);

    const step = createStep();
    const deps: FlowDeps = {
      step,
      explain: (reason) => emit(`\n• ${reason}\n\n`),
      confirm: async () => true,
      outDir,
    };

    try {
      await flow.run(page, deps);
      emit("\n✓ Flow complete\n");
      const savedFiles = await listPdfs(outDir);
      return {
        status: "ok",
        flow: { domain: flow.domain, intent: flow.intent },
        outDir,
        savedFiles,
        transcript: transcript.join(""),
      };
    } catch (err) {
      const stepErr = err as StepError;
      emit(
        `\n✗ Flow failed at step ${stepErr.stepIndex ?? "?"} "${stepErr.stepName ?? "unknown"}":\n  ${stepErr.message}\n`,
      );
      const savedFiles = await listPdfs(outDir);
      return {
        status: "failed",
        flow: { domain: flow.domain, intent: flow.intent },
        outDir,
        savedFiles,
        transcript: transcript.join(""),
        error: {
          stepName: stepErr.stepName,
          stepIndex: stepErr.stepIndex,
          message: stepErr.message,
        },
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit(`\n✗ ${message}\n`);
    return {
      status: "failed",
      flow: { domain: flow.domain, intent: flow.intent },
      outDir,
      savedFiles: await listPdfs(outDir),
      transcript: transcript.join(""),
      error: { message },
    };
  } finally {
    if (log) process.stdout.write = originalStdoutWrite;
    await browser.close().catch(() => {});
  }
}
