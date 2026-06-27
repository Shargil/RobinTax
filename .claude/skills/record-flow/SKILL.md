---
name: record-flow
description: Dev-only — record a new Smart Replay flow for one site via `playwright codegen`, sanitize per ADR-003 (strip login + credentials + session params, promote brittle selectors, replace waitForTimeout sleeps, wrap actions in step()), scaffold the TS flow module at `Collector/skill/src/flows/<domain>.ts`, and register it in `Collector/skill/src/registry.ts` + `run-flow.ts` so it's live on next replay. Use when the user invokes `/record-flow <site-url>` or "record flow for <site>". One site per invocation.
---

# record-flow — codegen → sanitize → flow module

Turn a `playwright codegen` recording into a canonical Smart Replay flow that the MCP server's `replay(site)` tool can execute. Dev-only — runs on Yam's laptop, the output gets committed to the repo and ships in the next plugin release.

## When to use

- Invoked as `/record-flow <site-url>` (e.g. `/record-flow https://www.btl.gov.il/...`).
- Conversational triggers: "record a flow for X", "let's capture the click sequence for Y".
- One site per invocation. Multi-site batches are separate chats — sanitization decisions are site-specific and reviewing five at once invites mistakes.

## Prereqs

- `npx playwright codegen` must be installed (`npx playwright install` once if needed).
- A throwaway login or sacrificial account for the target site. **DO NOT** record with your real production account if the site involves credentials you care about — codegen captures every fill, including passwords and OTPs (see [[feedback_codegen_credentials]]).
- Working dir is the RobinTax repo root.

## Phases

### 1. RECORD

Launch codegen against the target URL with the output captured to a temp file:

```bash
DOMAIN=$(echo "<site-url>" | sed -E 's|https?://([^/]+).*|\1|')   # e.g. www.btl.gov.il
TS_OUT="/tmp/codegen-${DOMAIN}.ts"
npx playwright codegen "<site-url>" --output "$TS_OUT" --target playwright-test
```

Tell the user:
> Codegen window is opening. Walk the full flow you want to record — including any clicks needed to navigate to the doc, expand UI sections, and trigger the download. Close the inspector window when you're done. I'll pick up the file from `/tmp/codegen-${DOMAIN}.ts` automatically.

Wait for codegen to exit (the `npx` command blocks until the inspector window closes).

### 2. READ + SANITIZE

Read `/tmp/codegen-${DOMAIN}.ts`. Then run the shared sanitizer:

```bash
node --experimental-strip-types -e "
import('${CLAUDE_PLUGIN_ROOT:-.}/Collector/skill/src/sanitize.ts').then(async ({ sanitizeFlow }) => {
  const fs = await import('node:fs/promises');
  const src = await fs.readFile('/tmp/codegen-${DOMAIN}.ts', 'utf8');
  const { sanitized, warnings } = sanitizeFlow(src);
  await fs.writeFile('/tmp/codegen-${DOMAIN}.sanitized.ts', sanitized);
  console.log(JSON.stringify(warnings, null, 2));
});
"
```

Show the user:
1. A short diff summary (one line per change category: "stripped login block", "5 credential fills replaced with `<STRIPPED>`", "stripped 3 session-token URL params").
2. The warning list grouped by kind. For each `wait-for-timeout` and `brittle-selector` warning, ask the user inline:
   > Line N: `await page.waitForTimeout(3000)`. What content should I wait for instead? (e.g. "the file-download link to appear", "the post-login banner to render"). Give me a selector or description.
   > Line N: `:nth-child(3)` selector. What's a stable identifier? (role + name, text content, aria-label?)
   Apply each answer as an Edit to the sanitized file.

### 3. WRAP + EMIT

Read the (now-sanitized + corrected) file at `/tmp/codegen-${DOMAIN}.sanitized.ts`. Transform it into a flow module:

1. Convert codegen's `test('...', async ({ page }) => {...})` shell into:
   ```ts
   import type { Page } from "playwright-core";
   import type { FlowDeps } from "../types.ts";

   export const domain = "<domain>";
   export const intent = "<one-line: what doc this fetches>";

   export async function run(page: Page, deps: FlowDeps): Promise<void> {
     const { step, explain, outDir } = deps;
     // ... actions, each wrapped in step()
   }
   ```
2. **Wrap every top-level action** in `step("<short verb> <object>", async () => { … })`. Auto-name from the action: `page.getByRole('button', {name: 'הורד'}).click()` → `step("click הורד", async () => …)`. Show the user the proposed names and let them rename any that are unclear.
3. **Header comment** mirrors [`Collector/skill/src/flows/ita.gov.il.ts:1-10`](../../Collector/skill/src/flows/ita.gov.il.ts) — what was sanitized, what's the acquisition shape (per [pdf-download-methods](../../skills/get-doc/lessons/pdf-download-methods.md)), any quirks discovered during recording.
4. **Output path**: `Collector/skill/src/flows/<domain>.ts`. If a file already exists at that path (an LLM-generated candidate or a prior recording), **save as `<domain>.candidate.ts` instead** to avoid clobbering — show the user a diff and let them merge.

### 4. REGISTER

Two registration files to update:

1. **[`Collector/skill/src/registry.ts`](../../Collector/skill/src/registry.ts)** — add `"<doc-slug>": "<flow-key>"` to the `DOC_TO_FLOW` map. The `<doc-slug>` matches `Collector/documents/<slug>.md`. The `<flow-key>` is a short identifier (e.g. `"ita"`, `"btl"`); ask the user if not obvious from the domain.
2. **[`Collector/skill/src/run-flow.ts`](../../Collector/skill/src/run-flow.ts)** — add `import * as <key>Flow from "./flows/<domain>.ts";` and an entry in the `FLOWS` record: `<key>: <key>Flow`. The MCP server's `replay` tool reads this map to validate the `site` arg.

### 5. UPDATE PER-DOC PLAYBOOK

In `Collector/documents/<doc-slug>.md`'s playbook section, replace any LLM-discovered snippets with the one-line pointer pattern (see [Collector/documents/form-106.md](../../Collector/documents/form-106.md) as the reference example):

> **Implemented as a Smart Replay flow** at [`Collector/skill/src/flows/<domain>.ts`](../skill/src/flows/<domain>.ts).
>
> The flow file is the executable, source-of-truth spec for the click sequence. [...]

### 6. VERIFY

Tell the user to run, in a separate terminal:

```bash
cd Collector/skill && npm run flow <flow-key>
```

This invokes the CLI runner (not the MCP server) — useful for debugging the flow without going through Claude Code. If it works there, the MCP `replay` tool will work too.

Then commit the changes:

```bash
git add Collector/skill/src/flows/<domain>.ts \
        Collector/skill/src/registry.ts \
        Collector/skill/src/run-flow.ts \
        Collector/documents/<doc-slug>.md
```

## When the recording doesn't work

- **Codegen crashes or freezes**: re-launch with `--browser firefox` or `--browser webkit` — Chromium codegen has flaky moments on macOS Sonoma+.
- **The sanitizer's login-block heuristic warns but doesn't strip**: the recording's login flow doesn't match the regex (`/login|signin|auth|otp|.../i`). Hand-strip the login block in the sanitized file before phase 3.
- **An action depends on a `blob:` download**: that's Pattern C (or Pattern A if base64-in-JSON). Reference [`pdf-download-methods.md`](../../skills/get-doc/lessons/pdf-download-methods.md) and pick the right capture method — codegen records the click but not the bytes capture; you author that part by hand.

## Self-edit rule

If during a recording you discover a new sanitization rule (a new PII pattern, a new credential-context regex, a new brittle-selector pattern), edit [`Collector/skill/src/sanitize.ts`](../../Collector/skill/src/sanitize.ts) directly to add it. The same sanitizer is used by the shipped `contribute-flow` skill, so improvements benefit both code paths. Mention the change in your final message.

## Related

- [Collector ADR-003](../../Collector/decisions/ADR-003-recording-via-playwright-codegen.md) — the recording ritual this skill automates.
- [Collector ADR-004](../../Collector/decisions/ADR-004-ts-flow-modules.md) — flow module format.
- [`Collector/documents/recordings/ishurim.prat.idf.il.recording.ts`](../../Collector/documents/recordings/ishurim.prat.idf.il.recording.ts) — reference example of a sanitized codegen output.
