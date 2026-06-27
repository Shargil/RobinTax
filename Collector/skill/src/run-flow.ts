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
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { createStep } from "./step.ts";
import type { Flow, FlowDeps, StepError } from "./types.ts";

import * as itaFlow from "./flows/ita.gov.il.ts";
import * as btlFlow from "./flows/btl.gov.il.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));

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

// Force-focus the user's Chrome and (on macOS) split-screen editor + browser
// so the user can see the flow start and act on it (log in, click OTP, etc.).
//
// Three-step ritual, in this order:
//   1. osascript activate — moves the Chrome APP to the foreground. Required
//      because page.bringToFront() only switches between Chrome's tabs; if
//      Chrome itself is hidden behind the terminal, the user still can't see
//      anything. This was a real bug surfaced 2026-06-21.
//   2. page.bringToFront() — picks the right tab within Chrome.
//   3. split-screen.sh — arranges editor + Chrome side-by-side.
//
// Runs SYNCHRONOUSLY with error capture and emits a clear failure note for
// each sub-step. The previous detached/silent version masked failures and
// left users watching a black-box timeout.
async function bringToFrontAndSplit(
  page: Page,
  emit: (s: string) => void,
): Promise<void> {
  // 1. Activate Chrome app (macOS-only; no-op elsewhere).
  if (process.platform === "darwin") {
    try {
      execSync(`osascript -e 'tell application "Google Chrome" to activate'`, {
        stdio: "ignore",
        timeout: 3000,
      });
      emit(`  · Chrome activated (osascript)\n`);
    } catch (err) {
      emit(
        `  ! couldn't activate Chrome via osascript: ${(err as Error).message}\n`,
      );
    }
  }

  // 2. Switch to the right tab within Chrome.
  try {
    await page.bringToFront();
    emit(`  · target tab focused\n`);
  } catch (err) {
    emit(
      `  ! page.bringToFront() failed: ${(err as Error).message} (flow will still run, but you may not see the tab)\n`,
    );
  }

  if (process.platform !== "darwin") return;

  // 3. Split-screen editor + Chrome.
  // CLAUDE_PLUGIN_ROOT is set when the MCP server runs inside the plugin;
  // when run standalone (`npm run flow`) we walk up to the repo root.
  const root = process.env.CLAUDE_PLUGIN_ROOT ?? path.resolve(HERE, "../../..");
  const script = path.join(root, "skills", "get-doc", "scripts", "split-screen.sh");
  emit(`  · split-screen script: ${script}\n`);
  const result = spawnSync("bash", [script], { encoding: "utf8", timeout: 5000 });
  if (result.error) {
    emit(`  ! split-screen.sh failed to spawn: ${result.error.message}\n`);
  } else if (result.status !== 0) {
    emit(
      `  ! split-screen.sh exited ${result.status}: ${(result.stderr || result.stdout || "").trim()}\n`,
    );
  } else {
    emit(`  · split-screen ok\n`);
  }
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
    emit(`→ Output dir: ${outDir}\n`);
    emit(`→ Focusing Chrome + split-screening (macOS)…\n`);
    await bringToFrontAndSplit(page, emit);
    emit(`\n`);

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
