# RobinTax

Get your Israeli tax refund. The skill drives your own Chrome to collect tax-refund documents (ITA, Bituach Leumi, employers, banks, pension funds), then computes per-year refund + a file/don't-file recommendation. Math is deterministic. Every load-bearing value is second-checked by a different model. You confirm every bottom line. The product never sees your credentials.

**Status:** v0.1 — collect + calculate stages built. Filing stage not yet built.
**Platform:** macOS for full features. Windows runs without the OS reminder backend (see "Platform support" below).

## Install

Prerequisite: [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and authenticated. Chrome with your gov.il / ITA / BTL / employer logins already in your daily browser profile.

### Option A — Install as a Claude Code plugin (recommended)

In Claude Code:

```
/plugin marketplace add Shargil/RobinTax
/plugin install robintax@robintax
```

Then anywhere:

```
/robintax:robintax
```

Skills surface namespaced: `/robintax:robintax`, `/robintax:get-doc`, `/robintax:calc-refund`.

### Option B — Dev mode (work on the skills themselves)

```
git clone https://github.com/Shargil/RobinTax.git
cd RobinTax
claude --plugin-dir .
```

Same namespaced skills, but you edit the source in-place.

## First run

Type `/robintax:robintax`. It will:

1. Create `~/Downloads/RobinTax/` (where every collected doc lands).
2. Detect your platform and surface what features are available (macOS = full; Windows/Linux = degraded reminders).
3. Read your journey ledger at `~/.claude/projects/<scope>/memory/journey.md` (created if missing).
4. Report what you have / what's missing.
5. Propose the next document and, on your go-ahead, route to `/robintax:get-doc <slug>`.

The first `/robintax:get-doc` run also bootstraps the [Playwriter](https://github.com/remorses/playwriter) Chrome extension so the skill can attach to your existing Chrome via CDP. You'll see a yellow "Chrome is being controlled by automated software" banner — that's the extension, not a phishing attempt.

You log in to gov.il / ITA / BTL / your bank yourself; the skill polls for the dashboard signal and resumes. Per [ADR-001](docs/decisions/ADR-001-no-credential-proxy.md), the skill never types passwords or one-time codes.

## What it does

Three skills, three stages:

- **`/robintax:robintax`** — front door. Reads your ledger, reports where you stand, routes to the next worker.
- **`/robintax:get-doc <slug>`** — collection worker. Drives your Chrome through one document's flow, captures the PDF to `~/Downloads/RobinTax/<year>/<slug>.pdf`, updates the ledger. Learns from each run and writes back a sanitized playbook to [`Collector/documents/<slug>.md`](Collector/documents/).
- **`/robintax:calc-refund [year]`** — calculation worker. Runs deterministic per-year math via [`Calculator/engine/`](Calculator/engine/) against year-versioned rule tables in [`Calculator/rules/`](Calculator/rules/), then a blind cross-check via [`Calculator/verifier/`](Calculator/verifier/) on every load-bearing value. Renders one combined report; you confirm before anything is written back.

## Platform support

**macOS (tested):** full features. Apple Reminders back the pending-doc cohort + auto-recheck lifecycle ([ADR-012](docs/decisions/ADR-012-apple-reminders-for-pending-docs.md)). `split-screen.sh` arranges your editor + browser side-by-side.

**Windows (untested):** runs, but degraded. No OS-level reminders — auto-recheck only fires when you manually re-run `/robintax:robintax` and a cohort ETA has passed. No automatic window splitting. A Windows reminder backend using Task Scheduler + PowerShell toasts is sketched in [`skills/robintax/SKILL.md`](skills/robintax/SKILL.md#windows-reminder-backend--todo); not yet built. **If you try this on Windows, please file an issue with what worked and what didn't.**

**Linux:** same as Windows — runs without reminders or window splitting.

## Requirements

- Claude Code (current version, with `/plugin` available)
- Chrome with your gov logins
- Node ≥ 22.6 (`brew install node@22` on macOS; `winget install OpenJS.NodeJS.LTS` on Windows; `nvm install 22` on Linux). The Calculator uses `node --experimental-strip-types` which is 22.6+ only.
- No Anthropic API key needed — the verifier shells out to `claude -p --model <m>`, reusing your existing Claude Code auth.

## Permissions on first run

Plugin manifests cannot grant their own permissions (this is a Claude Code security feature). On your first run you'll be prompted to allow the skills to invoke `npx playwriter`, `node`, `osascript`, `mkdir`, and a few others. Approve them once; subsequent runs are quiet.

## Repo layout

- [`skills/`](skills/) — the three plugin skills (`robintax`, `get-doc`, `calc-refund`)
- [`Collector/`](Collector/) — per-document research + playbooks the `get-doc` skill consumes/updates
- [`Calculator/`](Calculator/) — TypeScript engine, year-versioned rule tables, second-check verifier
- [`docs/decisions/`](docs/decisions/) — repo-wide ADRs (credentials, gating, journey ledger, reminders)
- [`.claude-plugin/`](.claude-plugin/) — plugin manifest + marketplace catalog
- [`.claude/skills/`](.claude/skills/) — dev-only meta-skills (e.g. `monorepo-mega-skill`); not shipped in the plugin
- [`GTM/`](GTM/) — go-to-market assets

## What "second-checked" means

For every value that flows into the refund math — an income figure off a 106, withheld tax off a BTL form, a soldier-points eligibility judgment, etc. — the skill runs a **blind** cross-check via [`Calculator/verifier/verify.ts`](Calculator/verifier/verify.ts) using a different model family from the primary (`haiku` by default; `sonnet` for higher-stakes claims). If the two answers agree, the skill says nothing. If they disagree or one is uncertain, you're asked which is right before the engine proceeds. See [Calculator ADR-001](Calculator/decisions/ADR-001-second-check-verifier.md).

The combined per-year report goes through the renderer once — you confirm `y/n` before anything is written back to the ledger. The skill never silently commits to a refund number.

## License

TBD.
