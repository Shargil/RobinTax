---
name: user-clean-run
description: Dev-only — wipe the per-user RobinTax state files (journey, profile, platform, intake.draft) so the next `/robintax:robintax` behaves like a fresh install. Auto-memory feedback files are preserved. Use when the user says "clean run", "fresh run", "reset robintax", "wipe my state".
---

# user-clean-run — wipe RobinTax per-user runtime state

Deletes RobinTax's per-user runtime state from the auto-memory dir so the next `/robintax:robintax` hits the first-install welcome and routes to intake as a genuine first run.

## When to use

- User says "clean run", "fresh run", "reset robintax", "wipe my state".
- User wants to try the plugin from zero without losing their auto-memory (feedback, project, user, reference files).

## What it deletes

Only these four files, all under `~/.claude/projects/-Users-shargil-Documents--------------2026-05-14----------RobinTax/memory/`:

- `journey.md` — cross-skill ledger ([ADR-011](../../../docs/decisions/ADR-011-user-journey-ledger.md))
- `profile.md` — intake output ([ADR-013](../../../docs/decisions/ADR-013-user-profile-and-intake.md))
- `platform.md` — first-install marker (its presence skips the platform welcome — see [skills/robintax/SKILL.md:24-29](../../../skills/robintax/SKILL.md#L24-L29))
- `intake.draft.md` — paused-intake resume marker

## What it NEVER touches

- `MEMORY.md`, any `feedback_*.md`, `user*.md`, `project_*.md`, `reference_*.md` — these are auto-memory the user wants to keep across runs.
- Anything outside the memory dir (no `Users/` doc cleanup, no git ops, no `Collector/` artifacts).

## Steps

1. List which of the four target files currently exist (one `ls | grep` is fine). If none, say "already clean" and skip to step 5 (still open the Terminal — the user invoked this skill because they want to start a fresh run, not because they want a delete report).
2. Show the user the list and confirm once. Don't gate per-file.
3. `rm -f` only the existing targets. Confirm with a single `ls | grep` showing the targets are gone.
4. Tell the user: restart any running `claude` session in that repo (the deleted files are still cached in its context).
5. Open a new Terminal at the repo with the dev command running, then tell the user to switch to it and type `/robintax:robintax`:

   `osascript -e 'tell application "Terminal" to do script "cd \"<repo>\" && claude --plugin-dir ."' -e 'tell application "Terminal" to activate'`
