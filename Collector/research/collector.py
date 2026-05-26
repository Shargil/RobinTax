"""Collector MVP entry point — Form 106 from the ITA personal area.

Usage:
    cd Collector
    pip install -r requirements.txt
    python -m playwright install chromium  # one-time
    python collector.py

Honors:
- ADR-001 (repo)         — never sees the user's credentials.
- ADR-009 (repo)         — user performs login; we wait for a post-login signal.
- ADR-010 (repo)         — explain reason before every action; y/n gate very scary ones.
- ADR-001 (Collector)    — Playwright + CDP attach on port 9222, headful, reuse profile.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright

from flows import ita

CDP_PORT = 9222
CDP_URL = f"http://127.0.0.1:{CDP_PORT}"

CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CHROME_USER_DATA_DIR = Path.home() / "Library/Application Support/Google/Chrome"

PORT_WAIT_SECONDS = 30  # session restore with many tabs can be slow


def detect_chrome_profile() -> str:
    """Return the profile directory Chrome was last using (e.g. 'Default', 'Profile 3').

    We must pass `--profile-directory=<name>` explicitly: if the user has more
    than one profile and we only pass `--user-data-dir`, Chrome shows a profile
    picker and the picked browser process spawns *without* our debug flag.
    """
    try:
        state = json.loads((CHROME_USER_DATA_DIR / "Local State").read_text())
        return state.get("profile", {}).get("last_used") or "Default"
    except (OSError, ValueError, KeyError):
        return "Default"


def explain(reason: str) -> None:
    """ADR-010: state why before acting."""
    print(f"\n→ {reason}", flush=True)


def confirm(action: str, reason: str, auto_yes: bool = False) -> bool:
    """ADR-010: y/n gate for very scary actions.

    `auto_yes=True` skips the prompt but still prints the human-readable reason —
    intended for AI/Claude-Code invocations where consent has already been
    collected through the calling UI. Don't use it to silence prompts in a
    headless cron job: the whole point of ADR-010 is the user sees what we did.
    """
    explain(reason)
    if auto_yes:
        print(f"  {action} (y/n): y  [pre-authorized via --yes]", flush=True)
        return True
    return input(f"  {action} (y/n): ").strip().lower() == "y"


def cdp_port_open(port: int = CDP_PORT) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _chrome_is_running() -> bool:
    return (
        subprocess.run(
            ["pgrep", "-x", "Google Chrome"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode
        == 0
    )


def _quit_chrome_gracefully() -> None:
    """Ask Chrome to quit via AppleScript so it writes its session-restore state.
    A graceful quit is what makes `--restore-last-session` and Cmd+Shift+T work
    when we relaunch — a force-kill loses tabs.
    """
    if not _chrome_is_running():
        return
    subprocess.run(
        ["osascript", "-e", 'tell application "Google Chrome" to quit'],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 10
    while time.time() < deadline:
        if not _chrome_is_running():
            return
        time.sleep(0.3)
    raise RuntimeError(
        "Chrome did not quit within 10s. Save your work and quit Chrome manually, then re-run."
    )


def relaunch_chrome_with_debugger() -> None:
    _quit_chrome_gracefully()
    profile = detect_chrome_profile()
    print(f"  Relaunching Chrome with profile '{profile}'.", flush=True)
    subprocess.Popen(
        [
            CHROME_BIN,
            f"--remote-debugging-port={CDP_PORT}",
            f"--user-data-dir={CHROME_USER_DATA_DIR}",
            f"--profile-directory={profile}",
            "--restore-last-session",
            "--no-first-run",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + PORT_WAIT_SECONDS
    while time.time() < deadline:
        if cdp_port_open():
            return
        time.sleep(0.5)
    raise RuntimeError(
        f"Chrome did not expose CDP on port {CDP_PORT} within {PORT_WAIT_SECONDS}s."
    )


async def attach_and_run() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0]
        page = await context.new_page()
        await ita.run(page)


def ensure_chrome_with_debugger(auto_yes: bool = False) -> bool:
    if cdp_port_open():
        explain(
            f"Chrome is already running with the debugger port ({CDP_PORT}). "
            "Attaching to your existing session — no relaunch needed."
        )
        return True

    if not confirm(
        action="Relaunch Chrome now",
        reason=(
            "To drive your real Chrome session, I need to relaunch Chrome with a "
            f"debugger port (--remote-debugging-port={CDP_PORT}). Without this, the "
            "tax sites see us as a bot.\n"
            "  Your current Chrome windows will close, then reopen with the same "
            "tabs restored (Chrome session-restore + --restore-last-session). If "
            "anything doesn't come back, press Cmd+Shift+T to reopen the last "
            "closed window.\n"
            "  The relaunched Chrome uses your normal profile, so you stay "
            "logged in everywhere."
        ),
        auto_yes=auto_yes,
    ):
        return False

    relaunch_chrome_with_debugger()
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Collect Form 106 from the ITA personal area.",
    )
    parser.add_argument(
        "--yes", "-y",
        action="store_true",
        help=(
            "Pre-authorize the Chrome relaunch. The human-readable reason still "
            "prints (ADR-010). Use this when invoking from Claude Code or any "
            "other UI that already collected consent."
        ),
    )
    args = parser.parse_args()

    if not ensure_chrome_with_debugger(auto_yes=args.yes):
        print("Aborted.")
        return 1

    asyncio.run(attach_and_run())
    return 0


if __name__ == "__main__":
    sys.exit(main())
