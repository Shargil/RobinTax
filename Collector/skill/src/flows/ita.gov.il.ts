// ITA personal area — Form 106 collection.
//
// Ported from Collector/research/flows/ita.py. Click path was recorded with
// `playwright codegen` and then sanitized per ADR-003:
//   - login steps stripped (user performs login themselves at runtime — repo ADR-009)
//   - credentials stripped (repo ADR-001)
//   - brittle nth-child selectors replaced with role/text locators
//   - sleeps replaced with content waits
// Each action wrapped in `step(...)` so failures point at the right place
// for heal-back (see ADR-004).

import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { Page, Locator } from "playwright-core";
import type { FlowDeps } from "../types.ts";

const PERSONAL_AREA_URL =
  "https://secapp.taxes.gov.il/sr-ezor-ishi/main/main-page";

// Post-login signal — only present once the user is authenticated.
const POST_LOGIN_LINK_NAME = "ניווט למערכת טפסי 106";

const SESSION_KEEPALIVE_BUTTON_NAME = "המשך לגלוש באתר";

const LOGIN_WAIT_MS = 5 * 60 * 1000; // user may need an OTP
const POPUP_WAIT_MS = 30 * 1000;

export const domain = "ita.gov.il";
export const intent = "form 106";

function defaultYears(): number[] {
  // ITA lookback is six years. Current year may also have a partial form.
  const thisYear = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => thisYear - 6 + i);
}

// Recursively search a JSON value for a string that looks like base64-
// encoded PDF data. PDF files start with `%PDF`, which is `JVBERi` in
// base64, so any string field with that prefix is the bytes we want.
function findPdfBase64(obj: unknown): string | null {
  if (typeof obj === "string") {
    return obj.startsWith("JVBERi") ? obj : null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findPdfBase64(item);
      if (found) return found;
    }
    return null;
  }
  if (obj && typeof obj === "object") {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      const found = findPdfBase64(val);
      if (found) return found;
    }
  }
  return null;
}

async function downloadViaPopup(
  page: Page,
  trigger: Locator,
  targetPath: string,
): Promise<void> {
  // ITA's frontend fetches a JSON envelope like
  //   { "dataForm106": "<base64 of %PDF...>" }
  // then decodes it client-side, creates a Blob, and opens the resulting
  // `blob:` URL in a new tab — so the popup URL is unreachable from outside
  // the page (origin-scoped blob storage). The bytes only exist on the wire
  // ONCE, in that one JSON response. We capture it as it arrives.
  // ADR-002 hybrid: UI click for user-visible consent, response capture for
  // the actual bytes.
  const captured: { json: unknown }[] = [];
  const handler = (response: import("playwright-core").Response) => {
    if (response.status() !== 200) return;
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    // Read the body in the background; we'll scan it after the click resolves.
    response
      .json()
      .then((json) => captured.push({ json }))
      .catch(() => {
        // not JSON-parseable — ignore
      });
  };
  page.on("response", handler);

  // Pre-arm the popup waiter so we don't miss the open event.
  const popupPromise = page
    .waitForEvent("popup", { timeout: POPUP_WAIT_MS })
    .catch(() => null);

  try {
    await trigger.click();
    const popup = await popupPromise;

    // The JSON response should arrive at most a few seconds after the click.
    // Give it a beat to settle so `captured` includes it.
    const deadline = Date.now() + POPUP_WAIT_MS;
    let pdfBase64: string | null = null;
    while (Date.now() < deadline) {
      for (const { json } of captured) {
        const found = findPdfBase64(json);
        if (found) {
          pdfBase64 = found;
          break;
        }
      }
      if (pdfBase64) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!pdfBase64) {
      throw new Error(
        `No JSON response containing a base64 PDF arrived within ${POPUP_WAIT_MS}ms`,
      );
    }

    await fs.writeFile(targetPath, Buffer.from(pdfBase64, "base64"));

    // Close the user-visible viewer tab; we have the bytes already.
    await popup?.close().catch(() => {});
  } catch (err) {
    // Diagnostic safety net — list every JSON response we saw so failure is
    // debuggable from the saved file alone.
    try {
      const debugBase = targetPath.replace(/\.pdf$/, "");
      const summary = captured.map(({ json }) => {
        if (json && typeof json === "object") {
          return Object.keys(json as Record<string, unknown>).join(",");
        }
        return typeof json;
      });
      await fs.writeFile(
        `${debugBase}__captured.txt`,
        `responses (${captured.length}):\n` +
          summary.map((s, i) => `  ${i}: ${s}`).join("\n") +
          "\n",
      );
      console.log(`   [debug] captured response summary → ${debugBase}__captured.txt`);
    } catch {
      // diagnostic failure shouldn't mask the real one
    }
    throw err;
  } finally {
    page.off("response", handler);
  }
}

async function downloadYear(
  page: Page,
  year: number,
  outDir: string,
  step: FlowDeps["step"],
): Promise<string[]> {
  const yearSummary = page.locator("summary").filter({ hasText: String(year) });
  if ((await yearSummary.count()) === 0) return [];

  await step(`expand year ${year}`, async () => {
    await yearSummary.first().click();
  });

  // Content loads async after expand. Wait for either button to appear for
  // THIS year, capped at 5s. If neither shows, the year has no data for this
  // user and we move on cleanly.
  const showButtonsYear = page.getByRole("button", {
    name: new RegExp(`^להצגת טופס 106 שנת.*${year}`),
  });
  const summaryButtonsYear = page.getByRole("button", {
    name: new RegExp(`^למסמך ריכוז הכנסות שנת.*${year}`),
  });
  try {
    await Promise.race([
      showButtonsYear.first().waitFor({ state: "visible", timeout: 5000 }),
      summaryButtonsYear.first().waitFor({ state: "visible", timeout: 5000 }),
    ]);
  } catch {
    // No data for this year. Leave a quiet note; the loop will collapse and
    // move on.
    console.log(`     (no documents for ${year})`);
  }

  const saved: string[] = [];

  const showButtons = showButtonsYear;
  const count106 = await showButtons.count();
  for (let i = 0; i < count106; i++) {
    const target = path.join(
      outDir,
      count106 === 1
        ? `106__${year}.pdf`
        : `106__${year}__${i + 1}.pdf`,
    );
    await step(
      `download 106 (${i + 1}/${count106}) for ${year}`,
      async () => {
        await downloadViaPopup(page, showButtons.nth(i), target);
      },
    );
    saved.push(target);
  }

  const summaryButtons = summaryButtonsYear;
  if ((await summaryButtons.count()) > 0) {
    const target = path.join(outDir, `income-summary__${year}.pdf`);
    await step(`download income summary for ${year}`, async () => {
      await downloadViaPopup(page, summaryButtons.first(), target);
    });
    saved.push(target);
  }

  await step(`collapse year ${year}`, async () => {
    await yearSummary.first().click();
  });

  return saved;
}

export async function run(page: Page, deps: FlowDeps): Promise<void> {
  const { step, explain, outDir } = deps;

  await fs.mkdir(outDir, { recursive: true });

  explain(
    `Opening the ITA personal area. If you're not logged in yet, the site will redirect to login — log in there and I'll resume on the post-login signal.`,
  );

  await step("open personal area", async () => {
    await page.goto(PERSONAL_AREA_URL);
  });

  explain(
    `Waiting for the "${POST_LOGIN_LINK_NAME}" link to appear (up to 5 min). I never see your ID, password, or OTP — I'm only watching for that link, which only shows once you're inside.`,
  );

  await step("wait for post-login signal", async () => {
    await page
      .getByRole("link", { name: POST_LOGIN_LINK_NAME })
      .waitFor({ timeout: LOGIN_WAIT_MS });
  });

  await step("open Form 106 system", async () => {
    await page.getByRole("link", { name: POST_LOGIN_LINK_NAME }).click();
  });

  const years = defaultYears();
  const allSaved: string[] = [];
  for (const year of years) {
    const saved = await downloadYear(page, year, outDir, step);
    allSaved.push(...saved);
  }

  await step("dismiss keepalive prompt if present", async () => {
    const keepalive = page.getByRole("button", {
      name: SESSION_KEEPALIVE_BUTTON_NAME,
    });
    if ((await keepalive.count()) > 0) {
      try {
        await keepalive.first().click({ timeout: 2000 });
      } catch {
        // not clickable — harmless, prompt may have vanished
      }
    }
  });

  if (allSaved.length === 0) {
    console.log(
      `\n→ Done — no 106 forms were available in ${outDir}. ITA may not have received them yet.`,
    );
    return;
  }
  console.log(`\n→ Done. Saved ${allSaved.length} file(s) to ${outDir}:`);
  for (const p of allSaved) console.log(`   · ${path.basename(p)}`);
}
