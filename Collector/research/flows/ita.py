"""ITA personal area — Form 106 collection.

Drives the user's existing Chrome session on secapp.taxes.gov.il to download
every Form 106 (and the matching ריכוז הכנסות income summary) for the years
the site exposes — usually a six-year lookback.

Click path was recorded with `playwright codegen` and then sanitized:
- login steps stripped per ADR-009 (user performs login themselves)
- credentials stripped per ADR-001 (we never touch them)
- codegen's brittle nth-child selectors replaced with role/text locators
- sleep-style waits replaced with content waits

Honors:
- ADR-001 (repo)  — no credential proxy.
- ADR-009 (repo)  — user does the login; we wait on a post-login DOM signal.
- ADR-010 (repo)  — each step prints its reason before acting.
"""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

# Post-login signal — only present once the user is authenticated.
POST_LOGIN_LINK_NAME = "ניווט למערכת טפסי 106"

PERSONAL_AREA_URL = "https://secapp.taxes.gov.il/sr-ezor-ishi/main/main-page"

SHOW_106_BUTTON_RE = re.compile(r"^להצגת טופס 106 שנת")
INCOME_SUMMARY_BUTTON_RE = re.compile(r"^למסמך ריכוז הכנסות שנת")
SESSION_KEEPALIVE_BUTTON_NAME = "המשך לגלוש באתר"

LOGIN_WAIT_MS = 5 * 60 * 1000   # 5 minutes — user may need an OTP
POPUP_WAIT_MS = 30 * 1000


def _default_years() -> list[int]:
    # ITA lookback is six years. Current year may also have a partial form.
    this_year = datetime.now().year
    return list(range(this_year - 6, this_year + 1))


async def run(page, out_dir: Path | None = None, years: list[int] | None = None) -> None:
    out_dir = out_dir or (Path(__file__).resolve().parents[1] / "downloads" / "ita-106")
    out_dir.mkdir(parents=True, exist_ok=True)
    years = years or _default_years()

    print("\n→ Opening the ITA personal area. If you're not logged in, the site will redirect you to the login page.")
    await page.goto(PERSONAL_AREA_URL)

    print(
        "\n→ Please log in to your ITA personal area in the browser window now.\n"
        "  I will not see your ID, password, or OTP — I'm only watching for the\n"
        "  '" + POST_LOGIN_LINK_NAME + "' link to appear, which only shows up\n"
        "  once you're inside. I'll wait up to 5 minutes."
    )
    forms_link = page.get_by_role("link", name=POST_LOGIN_LINK_NAME)
    await forms_link.wait_for(timeout=LOGIN_WAIT_MS)
    print("→ Login detected. Opening the 106 forms system.")
    await forms_link.click()

    saved: list[Path] = []
    for year in years:
        saved.extend(await _download_year(page, year, out_dir))

    # Some sessions show a "keep browsing" keepalive prompt — dismiss politely if present.
    keepalive = page.get_by_role("button", name=SESSION_KEEPALIVE_BUTTON_NAME)
    if await keepalive.count() > 0:
        try:
            await keepalive.first.click(timeout=2000)
        except Exception:
            pass

    if saved:
        print(f"\n→ Done. Saved {len(saved)} file(s) to {out_dir}:")
        for path in saved:
            print(f"   · {path.name}")
    else:
        print(f"\n→ Done — no 106 forms were available in {out_dir}. ITA may not have received them yet.")


async def _download_year(page, year: int, out_dir: Path) -> list[Path]:
    """Expand a year's accordion, download every 106 + income summary in it, then collapse."""
    year_summary = page.locator("summary").filter(has_text=str(year))
    if await year_summary.count() == 0:
        return []

    print(f"\n→ Expanding year {year}.")
    await year_summary.first.click()

    saved: list[Path] = []

    show_buttons = page.get_by_role("button", name=SHOW_106_BUTTON_RE)
    count_106 = await show_buttons.count()
    for i in range(count_106):
        target = out_dir / (f"106__{year}.pdf" if count_106 == 1 else f"106__{year}__{i + 1}.pdf")
        print(f"  → Downloading 106 ({i + 1}/{count_106}) for {year} → {target.name}.")
        await _download_via_popup(page, show_buttons.nth(i), target)
        saved.append(target)

    summary_buttons = page.get_by_role("button", name=INCOME_SUMMARY_BUTTON_RE)
    if await summary_buttons.count() > 0:
        target = out_dir / f"income-summary__{year}.pdf"
        print(f"  → Downloading income summary for {year} → {target.name}.")
        await _download_via_popup(page, summary_buttons.first, target)
        saved.append(target)

    # Collapse the year back so the next expansion is clean.
    await year_summary.first.click()
    return saved


async def _download_via_popup(page, trigger, target_path: Path) -> None:
    """Click a button that opens a viewer popup, hit Download inside the popup's iframe, save."""
    async with page.expect_popup(timeout=POPUP_WAIT_MS) as popup_info:
        await trigger.click()
    popup = await popup_info.value
    try:
        iframe = popup.frame_locator("iframe").first
        download_button = iframe.get_by_role("button", name="Download")
        async with popup.expect_download(timeout=POPUP_WAIT_MS) as download_info:
            await download_button.click()
        download = await download_info.value
        await download.save_as(str(target_path))
    finally:
        await popup.close()
