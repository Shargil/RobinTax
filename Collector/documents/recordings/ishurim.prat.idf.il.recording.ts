// IDF certificates site (ishurim.prat.idf.il) — Service Conduct Certificate
// (אישור על מהלך שירות צבאי, form 830) collection flow.
//
// Recorded via two `playwright codegen` sessions and merged + sanitized per
// ADR-003:
//   - login steps stripped (user performs login themselves at runtime —
//     repo ADR-009). Raw recordings captured ID + password + OTP.
//   - credentials stripped (repo ADR-001).
//   - session-bound URL parameters (?session=...) stripped.
//   - codegen's exploratory clicks (share popup, status-page wandering,
//     double-clicks while orienting) dropped from the happy path.
//
// Acquisition shape: SAME-PORTAL ASYNC.
//   The cert page is a small state machine. After clicking the (830) tile,
//   the user lands on a row that shows one of:
//     1. "הופק בהצלחה"             → cert ready  → click "הורדת קובץ PDF" → real binary download
//     2. "האישור ממתין להפקה..."   → cert pending → no-op this run, retry next run
//     3. (no row exists)            → submit new   → click "להגשה" → "שליחת בקשות (1)" inside iframe
//   The portal itself tracks pending state, so the Collector does not need
//   a .pending/ directory or a Gmail-fetch stage. The email the portal
//   mentions is only a notification trigger; the bytes always live on the
//   portal. On every Collector run we just visit the page and act on
//   whichever state we find.
//
//   Download is a real binary (`page.waitForEvent('download')`) — same
//   pattern as BTL, NOT the ITA base64-in-JSON pattern. Through Playwriter
//   `download.saveAs` is broken ([[project_playwright_via_playwriter_relay_broken_apis]])
//   so the eventual port must use `page.evaluate(fetch)` for the actual
//   byte capture.

import { test } from "@playwright/test";

const HOME_URL = "https://ishurim.prat.idf.il/ords/r/hr/ishurim/בית";

test("collect IDF service conduct certificate (830)", async ({ page }) => {
  // [LOGIN STRIPPED — user authenticates via "הזדהות לאומית" (National
  //  Identification SSO) with ID number + password + email-delivered OTP.
  //  At runtime we wait on a post-login DOM signal instead — selector TBD.]

  // Post-login a prompt may appear (looked like 2FA enrollment); dismiss.
  await page.getByRole("link", { name: "לא כרגע" }).click();

  await page.goto(HOME_URL);

  // Open the form-830 tile. There appear to be two instances on the home
  // page (link + button); .nth(1) was what codegen recorded.
  await page
    .getByLabel("אישורים")
    .getByText("אישור על מהלך שירות צבאי (830)")
    .click();

  // ── STATE BRANCH ──
  // The resulting page shows one of three states; act based on what's
  // visible. (In the eventual flow module each branch becomes a separate
  // step() so failures point at the right place.)

  const readyMarker = page.getByText("הופק בהצלחה");
  const pendingMarker = page.getByText(
    "האישור ממתין להפקה, תשלח הודעת מייל ברגע שהסטטוס יעודכן",
  );

  if (await readyMarker.isVisible()) {
    // STATE 1 — cert ready, download it.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "הורדת קובץ PDF" }).click();
    const download = await downloadPromise;
    // NB: through Playwriter, download.saveAs fails — port must switch to
    // a page.evaluate(fetch) capture for the actual byte save.
    await download.saveAs("/tmp/idf-830-discharge.pdf");
  } else if (await pendingMarker.isVisible()) {
    // STATE 2 — pending. No-op this run; the next Collector run will
    // re-enter this same flow and re-check the state.
    return;
  } else {
    // STATE 3 — no existing request, submit a fresh one. Click path from
    // the FIRST recording: expand first card → "להגשה" → submit inside
    // the iframe. Verify on replay; row layout may differ when empty.
    await page.locator(".a-CardView-header").first().click();
    await page.getByRole("link", { name: "להגשה" }).first().click();
    await page
      .locator('iframe[title="הגשת בקשה"]')
      .contentFrame()
      .getByRole("button", { name: "שליחת בקשות (1)" })
      .click();
  }
});
