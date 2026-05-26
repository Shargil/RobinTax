// Bituach Leumi — annual unemployment compensation certificate (אישור שנתי
// למס הכנסה / אישור שנתי על תשלום דמי אבטלה).
//
// Recorded with `playwright codegen https://www.btl.gov.il/` then sanitized
// per ADR-003:
//   - Login (ID + phone + OTP) stripped — user performs login themselves at
//     runtime (repo ADR-009). Per ADR-001 and the codegen-credentials
//     memory, no credentials are ever stored here.
//   - Each action wrapped in `step(...)` so failures point at the right
//     place for heal-back.
//
// Mechanism: unlike ITA's base64-in-JSON envelope, BTL fires a real
// Playwright `download` event when the year-specific button is clicked.

import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { Page } from "playwright-core";
import type { FlowDeps } from "../types.ts";

const HOME_URL = "https://www.btl.gov.il/Pages/default.aspx";

// Post-login signal — the "אבטלה" top-nav submenu button only appears in
// the authenticated personal area.
const UNEMPLOYMENT_MENU_NAME =
  "אבטלה לפתיחת תת-תפריט לחץ על מקש enter";

// The annual income-tax certificate has a long accessible name; match the
// stable prefix.
const EXPAND_CERT_NAME_RE = /^לחץ להורדת המסמך אישור שנתי למס הכנסה/;

const LOGIN_WAIT_MS = 5 * 60 * 1000;
const DOWNLOAD_WAIT_MS = 30 * 1000;
const YEAR_BUTTON_WAIT_MS = 5 * 1000;

export const domain = "btl.gov.il";
export const intent = "unemployment annual income certificate";

function defaultYears(): number[] {
  // Tax-refund lookback is six years; BTL exposes the same range. We try
  // each and let absent-year detection skip cleanly.
  const thisYear = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => thisYear - 6 + i);
}

async function tryDownloadYear(
  page: Page,
  year: number,
  outDir: string,
  step: FlowDeps["step"],
): Promise<string | null> {
  // The expand-click opens a year-picker modal. On the success branch the
  // year-button click implicitly closes it; on the "no certificate for this
  // year" branch nothing closes it and it then intercepts every subsequent
  // click, breaking the next iteration. Wrap the whole attempt in try/
  // finally and press Escape on the way out — no-op if no modal is open.
  try {
    await step(`open certificate year picker (${year})`, async () => {
      await page
        .getByRole("button", { name: EXPAND_CERT_NAME_RE })
        .click();
    });

    const yearButton = page.getByRole("button", {
      name: `להורדת אישור לשנת ${year}`,
    });

    let exists = false;
    try {
      await yearButton
        .first()
        .waitFor({ state: "visible", timeout: YEAR_BUTTON_WAIT_MS });
      exists = (await yearButton.count()) > 0;
    } catch {
      exists = false;
    }
    if (!exists) {
      console.log(`     (no certificate for ${year})`);
      return null;
    }

  const target = path.join(outDir, `btl-unemployment__${year}.pdf`);
  await step(`download certificate for ${year}`, async () => {
    const downloadPromise = page.waitForEvent("download", {
      timeout: DOWNLOAD_WAIT_MS,
    });
    await yearButton.first().click();
    const download = await downloadPromise;

    // Two Playwright-via-CDP-relay quirks force us to bypass the normal
    // download path:
    //   1. `download.saveAs(target)` ENOENTs — Chrome writes the file to its
    //      own Downloads dir, but Playwright tries to copy from a temp path
    //      it expected to own but never received bytes at.
    //   2. `context.request.get(url)` fails — Playwriter's relay doesn't
    //      implement the `Storage.getCookies` CDP command Playwright's
    //      APIRequestContext uses to assemble auth headers.
    // We fetch from inside the page context instead: cookies attach
    // automatically (same origin, live document), fetch() returns the bytes
    // without triggering a second browser download. Bytes return to Node as
    // base64 to survive the bridge.
    const url = download.url();
    const base64 = await page.evaluate(async (downloadUrl) => {
      const r = await fetch(downloadUrl, { credentials: "include" });
      if (!r.ok) {
        throw new Error(`fetch returned ${r.status}`);
      }
      const buf = await r.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Chunked btoa — String.fromCharCode hits an argument-count cap on
      // large buffers when spread directly.
      let bin = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        bin += String.fromCharCode(
          ...bytes.subarray(i, i + chunkSize),
        );
      }
      return btoa(bin);
    }, url);
    await fs.writeFile(target, Buffer.from(base64, "base64"));

    // Cancel the in-progress browser-side download so we don't leave a
    // duplicate in the user's ~/Downloads. No-op if already finished.
    await download.cancel().catch(() => {});
  });

    return target;
  } finally {
    // Modal cleanup — see comment at top of function.
    await page.keyboard.press("Escape").catch(() => {});
  }
}

export async function run(page: Page, deps: FlowDeps): Promise<void> {
  const { step, explain, outDir } = deps;

  await fs.mkdir(outDir, { recursive: true });

  explain(
    `Opening Bituach Leumi. If you're not logged in to "שירות אישי", the site will route you there — log in (ID + phone + OTP). I never see your ID, phone, or OTP.`,
  );

  await step("open BTL home", async () => {
    await page.goto(HOME_URL);
  });

  await step("go to personal service login page", async () => {
    // From the home page, click "שירות אישי" to land on the login flow.
    // If we're already authenticated this link may have been replaced by a
    // profile menu, in which case the post-login signal will already be
    // visible and we just continue.
    try {
      const link = page.getByRole("link", { name: " שירות אישי" });
      await link.waitFor({ state: "visible", timeout: 3000 });
      await link.click();
    } catch {
      // link not present — likely already logged in, fall through.
    }
  });

  explain(
    `Now log in (ID + phone + OTP) in the browser window. I'll wait up to 5 min for the "אבטלה" submenu to appear — that's the signal you're inside the personal area.`,
  );

  await step("wait for post-login signal", async () => {
    await page
      .getByRole("button", { name: UNEMPLOYMENT_MENU_NAME })
      .waitFor({ timeout: LOGIN_WAIT_MS });
  });

  await step("open unemployment submenu", async () => {
    await page
      .getByRole("button", { name: UNEMPLOYMENT_MENU_NAME })
      .click();
  });

  await step("open certificates page", async () => {
    await page
      .getByLabel("אישי", { exact: true })
      .getByRole("link", { name: "אישורים" })
      .click();
  });

  const years = defaultYears();
  const allSaved: string[] = [];
  for (const year of years) {
    const saved = await tryDownloadYear(page, year, outDir, step);
    if (saved) allSaved.push(saved);
  }

  if (allSaved.length === 0) {
    console.log(
      `\n→ Done — no BTL unemployment certificates were available in ${outDir}.`,
    );
    return;
  }
  console.log(`\n→ Done. Saved ${allSaved.length} file(s) to ${outDir}:`);
  for (const p of allSaved) console.log(`   · ${path.basename(p)}`);
}
