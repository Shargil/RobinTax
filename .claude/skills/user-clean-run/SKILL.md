---
name: user-clean-run
description: Dev-only — factory-reset RobinTax to a genuine first-time-user state: wipe per-user state files (journey, profile, platform, intake.draft, local-flows), remove the project's installed node_modules, strip RobinTax's auto-seeded permissions, stop the Playwriter relay, prompt to manually remove the Chrome extension, and optionally uninstall the plugin (claude plugin uninstall robintax@robintax --prune) to test the real install flow. Node itself is NOT removed. Auto-memory feedback files are preserved. Use when the user says "clean run", "fresh run", "reset robintax", "wipe my state", "factory reset".
---

# user-clean-run — factory-reset RobinTax to a first-time-user state

Returns the machine to how it looked for a brand-new user, so the next `/robintax:robintax` exercises the full first-run path (Hello + welcome + consent, SessionStart dep-install, first-collect setup). This is a **Claude-driven skill, not a shell script** — it needs to edit `~/.claude/settings.json` carefully and to *wait* for the user to confirm the manual Chrome-extension removal.

## When to use

- User says "clean run", "fresh run", "reset robintax", "wipe my state".
- User wants to try the plugin from zero without losing their auto-memory (feedback, project, user, reference files).

## What it resets

**A. Per-user state files** — under `~/.claude/projects/-Users-shargil-Documents--------------2026-05-14----------RobinTax/memory/`:
- `journey.md` — cross-skill ledger ([ADR-011](../../../docs/decisions/ADR-011-user-journey-ledger.md))
- `profile.md` — intake output ([ADR-013](../../../docs/decisions/ADR-013-user-profile-and-intake.md))
- `platform.md` — platform marker (its presence skips re-detection)
- `intake.draft.md` — paused-intake resume marker
- `local-flows.md` — LLM-discovered local Smart Replay flows (if present)

**B. Installed node_modules** (so the WS2 SessionStart hook reinstalls clean next run). **Do NOT remove Node itself.**
- Installed mode: `~/.claude/plugins/data/robintax-robintax/node_modules` + its `package.json` marker.
- Dev mode (`--plugin-dir .`): the real `Collector/skill/node_modules` (or symlink) + the dev `Collector/skill/.plugin-data/` fallback dir.

**C. Auto-seeded RobinTax permissions** — from `~/.claude/settings.json`'s `permissions.allow`. Remove ONLY RobinTax's own entries (leave every other allow rule intact): `Write(<home>/.claude/projects/**/memory/**)`, `Bash(mkdir -p <home>/Downloads/RobinTax*)`, `Bash(uname*)`, `Bash(npx playwriter@latest *)`, `Bash(npx playwriter *)`, `mcp__plugin_robintax_smart-replay__replay`, `mcp__smart-replay__replay`, `Write(<home>/Downloads/RobinTax/**)`.

**D. The Playwriter relay** if running — `pkill -f "playwriter.*serve"` (or kill whatever holds port 19988).

**E. (Optional) The plugin install itself** — only when testing the **real marketplace-install path** (not dev `--plugin-dir .`). Run:

```bash
claude plugin uninstall robintax@robintax --prune
```

`--prune` also deletes the plugin's `${CLAUDE_PLUGIN_DATA}` dir, so this **covers B's installed-mode `node_modules`** — don't also `rm` that path if you ran the uninstall. After this, a fresh run is the *install flow* (marketplace add → install), which exercises the `claude plugin` steps a brand-new user hits.

## What it NEVER touches

- `MEMORY.md`, any `feedback_*.md`, `user*.md`, `project_*.md`, `reference_*.md` — auto-memory the user keeps across runs.
- Node, Chrome, or any global tool.
- Non-RobinTax entries in `settings.json`.
- The user's other docs (`Users/`), git, or source files.

## Steps

1. **Ask which mode.** One question first: is this a **dev reset** (running via `claude --plugin-dir .`) or a **full install-flow test** (the marketplace-installed plugin)? This decides whether E runs and what the fresh-run command is at the end.
2. **Survey + confirm once.** With `Read`/`ls`, report which of A–E are present (state files, node_modules locations, seeded perms, relay process, and — installed mode — the installed plugin). If everything's already clean, say so but continue (the user wants a fresh run, not a report). Show the plan and get one confirmation — don't gate per-item.
3. **E — uninstall (install-flow test only):** run `claude plugin uninstall robintax@robintax --prune`. This also removes the data-dir `node_modules`, so **skip B's installed-mode path** below. In dev mode, skip this step entirely.
4. **A — state files:** `rm -f` only the existing targets.
5. **B — node_modules:** `rm -rf` the locations that exist — dev-mode (`Collector/skill/node_modules` + `.plugin-data/`) always; installed-mode (`~/.claude/plugins/data/robintax-robintax/...`) **only if you did NOT run E** (the uninstall already handled it).
6. **C — permissions:** read `~/.claude/settings.json`, remove only the listed RobinTax entries from `permissions.allow`, write it back. Confirm the other entries are untouched.
7. **D — relay:** stop it if a process is found.
8. **Chrome extension (manual — wait for the user).** The extension can't be removed programmatically. Tell the user verbatim: *"Open chrome://extensions, remove the Playwriter extension, then tell me when it's gone."* **STOP and wait for their confirmation** before continuing — do not proceed on your own.
9. **Optional — collected docs:** ask whether to also clear `~/Downloads/RobinTax/` (it's their data; default no).
10. **Restart note + fresh run.** Tell the user to restart any running `claude` session (deleted files are still cached in its context). Then open a new Terminal at the repo and tell them which command to run:
    - **Dev reset:** `osascript -e 'tell application "Terminal" to do script "cd \"<repo>\" && claude --plugin-dir ."' -e 'tell application "Terminal" to activate'` — then `/robintax:robintax`.
    - **Install-flow test:** open a Terminal and run the brand-new-user sequence — `claude`, then inside it `/plugin marketplace add Shargil/RobinTax` → `/plugin install robintax@robintax` → `/robintax:robintax`. This exercises the install step itself.
