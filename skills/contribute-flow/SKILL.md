---
name: contribute-flow
description: Share a Smart Replay flow you discovered (via get-doc's LLM fallback) back to the RobinTax repo so other users benefit. Re-sanitizes the candidate flow at `Collector/skill/src/flows/<domain>.candidate.ts`, shows you the full file content, hard-gates with an "I have reviewed this for personal data" confirmation, then opens a PR via `gh` if installed or saves a local copy with sharing instructions. Use when the user invokes `/robintax:contribute-flow <domain>` or picks "Yes, sanitize and share" on the get-doc end-of-run prompt.
---

# contribute-flow — share a candidate Smart Replay flow upstream

A candidate flow is generated automatically when `/get-doc` falls through to LLM exploration and successfully fetches a doc for a domain that doesn't have a canonical flow yet (see `get-doc/SKILL.md` §5(e)). This skill takes that candidate, sanitizes it again as defense-in-depth, gates on explicit user review, and ships it back to the RobinTax repo.

**This is the skill that defines the contribution loop's trust boundary** — once a flow leaves the user's machine, it's potentially public. PII leaking through here is the worst-case failure mode of the entire skill, so the friction is intentional.

## When to use

- Invoked as `/robintax:contribute-flow <domain>` (e.g. `/robintax:contribute-flow www.example.gov.il`).
- Auto-invoked when the user picks "Yes, sanitize and share" on `/get-doc`'s end-of-run `AskUserQuestion`.
- Never auto-fires without the user picking the option or typing the slash command.

## Prereqs

- Candidate flow must exist at `Collector/skill/src/flows/<domain>.candidate.ts`. If it doesn't, tell the user: "No candidate flow found for <domain>. Run `/get-doc <slug>` first — the LLM-fallback path generates a candidate after a successful run."
- `gh` CLI (optional) — if installed and authenticated, the share path is a direct PR. If not, falls back to local file + manual share instructions.

## Phases

### 1. READ + RE-SANITIZE

Read `Collector/skill/src/flows/<domain>.candidate.ts`.

Ask the user (single `AskUserQuestion`):
> Are there any first names, last names, or email addresses I should explicitly scrub from the flow file? List them (comma-separated), or "none" if you can't think of any. I'll add them to the sanitizer's known-PII list before re-running.

Then run the sanitizer with the user's input:

```bash
node --experimental-strip-types -e "
import('${CLAUDE_PLUGIN_ROOT:-.}/Collector/skill/src/sanitize.ts').then(async ({ sanitizeFlow, leakCheck }) => {
  const fs = await import('node:fs/promises');
  const src = await fs.readFile('Collector/skill/src/flows/<domain>.candidate.ts', 'utf8');
  const knownNames = '<user input>'.split(',').map(s => s.trim()).filter(Boolean);
  const { sanitized, warnings } = sanitizeFlow(src, { knownNames });
  await fs.writeFile('/tmp/contribute-<domain>.ts', sanitized);
  const leaks = leakCheck(sanitized);
  console.log(JSON.stringify({ warnings, leaks }, null, 2));
});
"
```

If `leaks` is non-empty, **STOP and surface them to the user**: "The sanitizer's leak check found patterns still present after scrubbing: [list]. I won't share this until they're resolved. Edit `Collector/skill/src/flows/<domain>.candidate.ts` to remove them and re-run." Do not proceed.

### 2. SHOW + HARD-GATE

Read `/tmp/contribute-<domain>.ts` (the sanitized output) and **print the entire file** to the conversation — the user must see every line before approving. Then enumerate the sanitizer warnings (each with its line number and kind) so the user knows what was changed and what's still flagged.

Then fire one `AskUserQuestion`:
- **Question**: "I'm about to share the file printed above. I scrubbed [N] patterns and flagged [M] warnings — please confirm you've reviewed it and there's no personal data left (names, IDs, anything that could identify you)."
- **Header**: `Confirm share`
- **Option 1**: "Yes, I reviewed it — share it" — no recommended marker. The user must affirm explicitly; default to safe ("No") for the panel.
- **Option 2 (default — pressing Enter picks this)**: "No, abort — I want to review more" — leaves the candidate at `flows/<domain>.candidate.ts` and `/tmp/contribute-<domain>.ts` for them to edit manually.

If the user picks "No" → stop, tell them the files are at those paths for editing.

### 3. SHARE

If the user confirmed:

**Channel detection:**
```bash
gh auth status 2>&1 | grep -q "Logged in to" && echo "gh-ok" || echo "no-gh"
```

**PR path (gh available):**
1. `gh repo fork Shargil/RobinTax --clone=false --remote=false` (no-op if already forked).
2. Create a feature branch name: `contribute-flow-<domain>-<YYYY-MM-DD>`.
3. Use `gh api` to push the sanitized file to the user's fork on that branch:
   - PUT `repos/<user>/RobinTax/contents/Collector/skill/src/flows/<domain>.ts` with the base64 content, branch=feature-branch.
4. `gh pr create --repo Shargil/RobinTax --head <user>:<branch> --base main --title "New flow: <domain>" --body "$(cat <<EOF
Candidate Smart Replay flow for \`<domain>\` discovered via /get-doc LLM exploration.

**Intent**: <intent string from the flow file>
**Sanitization**: <N> patterns scrubbed, <M> warnings flagged (see sanitizer log below).
**What this fetches**: <user-provided one-line description — ask in this skill if not obvious>

Sanitizer warnings:
\`\`\`
<JSON dump of warnings from phase 1>
\`\`\`

Reviewer checklist (for Yam):
- [ ] Selector strategy looks robust (role/text, no nth-child / no high-entropy IDs)
- [ ] No personal data leaked through (re-run \`sanitize.ts\` if unsure)
- [ ] Register in \`Collector/skill/src/registry.ts\` + \`run-flow.ts\` to make it live
EOF
)"`
5. Print the PR URL to the user. Suggest they paste it into the journey ledger if relevant.

**Local-file path (no gh):**
1. Copy `/tmp/contribute-<domain>.ts` to `~/Downloads/RobinTax/contributed-flow-<domain>-<YYYY-MM-DD>.ts`.
2. Tell the user:
   > Saved to `~/Downloads/RobinTax/contributed-flow-<domain>-<YYYY-MM-DD>.ts`.
   > 
   > To share, attach it to a new GitHub issue at https://github.com/Shargil/RobinTax/issues/new — title suggestion: "New flow candidate: <domain>". Include the intent (what doc this fetches) and any quirks you noticed.
   > 
   > Or install `gh` (`brew install gh && gh auth login`) and re-run `/robintax:contribute-flow <domain>` for an automatic PR.

### 4. CLEANUP + LEDGER

Whatever the path:
1. Add a line to `<memory>/journey.md` under a `## Contributed flows` section (create if missing): `- <domain> — shared via <PR url | local file path> on <date>`.
2. Leave `Collector/skill/src/flows/<domain>.candidate.ts` in place — the user still uses it locally until the PR is merged and ships in a release. Don't delete.

## Trust boundary rules — non-negotiable

- **Never auto-share.** The user must pick "Yes, sanitize and share" on the get-doc panel OR explicitly invoke this slash command.
- **Never share without showing the full file.** Print every line of the sanitized file before the confirmation gate. No "trust me, it's fine".
- **Never bypass `leakCheck()`**. If it returns hits, hard-stop. No flag to override.
- **Default the confirmation panel to "No"**. Pressing Enter must abort, not share. This is the inverse of the get-doc end-of-run prompt (which defaults to "Yes, share") — at that prompt the user is opting INTO the flow; at this one they're approving a specific artifact going public.

## Why all this friction

The candidate flow file may have been generated by an LLM that saw a snapshot containing the user's name, tik, or other identifiers. The sanitizer catches the common patterns but is not perfect. Every leaked PII byte hurts the user permanently (public PR is forever in git history); every aborted share costs them ~30 seconds. The asymmetry justifies the friction.

## Related

- [get-doc SKILL.md §5(e)–(f)](../get-doc/SKILL.md) — where candidate flows come from and how the prompt to invoke this skill gets surfaced.
- [Collector/skill/src/sanitize.ts](../../Collector/skill/src/sanitize.ts) — the shared sanitizer + `leakCheck()` function.
- [Collector ADR-003](../../Collector/decisions/ADR-003-recording-via-playwright-codegen.md) — original recording ritual that the candidate file mimics.
- [feedback_codegen_credentials memory](../../.claude/projects/-Users-shargil-Documents--------------2026-05-14----------RobinTax/memory/feedback_codegen_credentials.md) — why credentials in recordings are a hard problem.
