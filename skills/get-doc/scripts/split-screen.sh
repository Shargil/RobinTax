#!/usr/bin/env bash
# Split the screen so the user can watch the browser next to their editor.
# Left half  -> the editor running Claude Code (default: "Code" = VS Code)
# Right half -> the browser (default: "Google Chrome"), which is then focused.
#
# Generic: reads the actual screen size at runtime, so it works on any display.
# Override the apps via env vars if needed:
#   EDITOR_APP="Cursor" BROWSER_APP="Google Chrome" ./split-screen.sh
#
# macOS only. Needs Accessibility permission for whatever runs it (Terminal /
# the Claude Code host). If windows don't move, that permission is missing.

set -euo pipefail

EDITOR_APP="${EDITOR_APP:-Code}"
BROWSER_APP="${BROWSER_APP:-Google Chrome}"

osascript <<EOF
-- Full resolution of the primary display.
tell application "Finder" to set screenBounds to bounds of window of desktop
set screenW to item 3 of screenBounds
set screenH to item 4 of screenBounds

set menuBar to 25                 -- leave room for the macOS menu bar
set halfW to screenW div 2
set usableH to screenH - menuBar

tell application "System Events"
  try
    tell process "${EDITOR_APP}"
      set position of front window to {0, menuBar}
      set size of front window to {halfW, usableH}
    end tell
  end try
  try
    tell process "${BROWSER_APP}"
      set position of front window to {halfW, menuBar}
      set size of front window to {screenW - halfW, usableH}
    end tell
  end try
end tell

tell application "${BROWSER_APP}" to activate
return "split: " & "${EDITOR_APP}" & " left, " & "${BROWSER_APP}" & " right (" & screenW & "x" & screenH & ")"
EOF
