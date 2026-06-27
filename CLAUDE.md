# RobinTax

Get Israeli users their tax refund money back, for cheaper, with no spam.

## Service map

- `Intake/` — eligibility intake: the conversation that runs first to figure out which docs the user needs and which calculator branches apply. Eligibility checklist surface at [`Intake/checklist.md`](Intake/checklist.md) (one line per selectable item, mapped to a `tax-rule/<slug>.md` spec or `none` for v2-stubs); follow-ups for each checked item live in `tax-rule/<slug>.md § Intake`; required-docs cross-reference at [`Intake/required-docs-matrix.md`](Intake/required-docs-matrix.md). Output: sanitized profile at `<memory>/profile.md` (per [ADR-013](docs/decisions/ADR-013-user-profile-and-intake.md)).
- `Collector/` — drives the user's own Chrome via Playwright + CDP to collect tax-refund documents from ITA, employer portals, banks, and pension funds. Runs inside the user's own browser session. Per-document research + playbooks live at [`Collector/documents/`](Collector/documents/).
- `Calculator/` — per-year refund computation. Deterministic math, LLM only at the edges, ITA as the final oracle. Engine ([`Calculator/engine/`](Calculator/engine/)), per-year rule tables ([`Calculator/rules/`](Calculator/rules/) — 2020–2025), and second-check verifier ([`Calculator/verifier/`](Calculator/verifier/)) all built.
- `GTM/` — go-to-market assets.
- `Test/` — test fixtures and harnesses.
- `Users/` — per-user test data.
- `tax_refund_documents_research.md` — long-form research on the refund-document landscape.

## Conventions

- **This repo IS the plugin.** Manifest at [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json), marketplace catalog at [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json). User-facing skills live at [`skills/`](skills/) per the Claude Code plugin spec.
- **Dev workflow:** `claude --plugin-dir .` from the repo root. Plugin skills are namespaced — invoke as `/robintax:robintax`, `/robintax:get-doc`, `/robintax:calc-refund` (the namespace prefix is the plugin name).
- Dev-only meta-skills (not shipped) live at [`.claude/skills/`](.claude/skills/) — `monorepo-mega-skill` (repo structure / ADRs / skill conventions), `canonicalize-rule` (per-rule canonicalization workflow that produces `tax-rule/<slug>.md`), and `record-flow` (Yam's `playwright codegen` → sanitize → ship-as-Smart-Replay-flow pipeline).
- Repo-wide ADRs live in [`docs/decisions/`](docs/decisions/); service-local ADRs live in `<service>/decisions/`. Scan filenames before making a new architectural call.
- The product never proxies or stores ITA credentials or bank-account fields. See [ADR-001](docs/decisions/ADR-001-no-credential-proxy.md).
- **Journey state**: each user's standing across the whole refund process (docs → calc → filing) lives in one per-user ledger at `<memory>/journey.md` (`<memory>` = the per-user `~/.claude/projects/<project>/memory/` dir). Any skill that changes user standing reads it at run start and updates it at run end. Contract: [ADR-011](docs/decisions/ADR-011-user-journey-ledger.md). Every intake selection must reach a terminal state (applied / dismissed / collected) by the pre-file gate or be surfaced to the user as an orphan — never silently dropped: [ADR-014](docs/decisions/ADR-014-intake-journey-reconciliation.md).
- **Bundled-asset paths in skills** must use `"${CLAUDE_PLUGIN_ROOT:-.}/Calculator/..."` etc. — the env var is set when installed, falls back to `.` (CWD) when developing with `--plugin-dir .`.

## Available skills (shipped in the plugin)

- `robintax` — **front door.** `/robintax:robintax` resumes the user's tax return: reads the journey ledger, reports standing across all stages (intake → collect → calculate → file), and routes to the next worker skill. Start here. Source: [`skills/robintax/`](skills/robintax/).
- `intake` — slash-command or `robintax`-routed worker for the **Intake** stage (first run). Renders the [`Intake/checklist.md`](Intake/checklist.md) eligibility surface as multi-select `AskUserQuestion` panels (4 items each), runs a disqualifier soft-gate, then batches every follow-up from the selected items' `tax-rule/<slug>.md § Intake` specs in one packed run. Writes a sanitized profile at `<memory>/profile.md` and seeds the journey ledger with the docs the profile implies. Source: [`skills/intake/`](skills/intake/).
- `get-doc` — slash-command-only (`/robintax:get-doc <document>`, or no-arg to resume collection) loop that fetches one of the catalogued tax-refund documents via the user's logged-in Chrome. PLAN phase first checks [`Collector/skill/src/registry.ts`](Collector/skill/src/registry.ts) — if the doc has a Smart Replay flow, it routes through the bundled `smart-replay` MCP server (zero-LLM happy path). Falls through to LLM-driven playwriter exploration when no flow exists or replay throws; on a successful LLM run for a new domain, authors a candidate flow and asks the user (via `AskUserQuestion`) if they want to share it via `contribute-flow`. Source: [`skills/get-doc/`](skills/get-doc/).
- `contribute-flow` — `/robintax:contribute-flow <domain>` or auto-invoked from get-doc's end-of-run share prompt. Re-sanitizes a candidate Smart Replay flow at `Collector/skill/src/flows/<domain>.candidate.ts`, hard-gates with a "I reviewed for personal data" confirmation, then ships via `gh pr create` if `gh` is installed (else saves a local file with manual share instructions). Source: [`skills/contribute-flow/`](skills/contribute-flow/).
- `calc-refund` — slash-command or `robintax`-routed worker for the **Calculate refund** stage. Computes per-year refund/owe + a file/don't-file recommendation via [`Calculator/engine/`](Calculator/engine/) + [`Calculator/rules/`](Calculator/rules/), second-checking every load-bearing value and human-confirming every bottom line via [`Calculator/verifier/`](Calculator/verifier/). Source: [`skills/calc-refund/`](skills/calc-refund/).
- `monorepo-mega-skill` — **dev-only**, not shipped. How this repo organizes CLAUDE.md, ADRs, and skills. Source: [`.claude/skills/monorepo-mega-skill/`](.claude/skills/monorepo-mega-skill/).

## Bundled MCP servers

[`.claude-plugin/plugin.json`](.claude-plugin/plugin.json)'s `mcpServers` field ships **`smart-replay`** with every install — no `claude mcp add` needed. The server lives at [`Collector/skill/src/server.ts`](Collector/skill/src/server.ts) and exposes one tool, `replay(site)`, for cached per-site flows. Auto-spawns the Playwriter relay on first call (idempotent) and shuts it down on disconnect. Consumed by the `get-doc` skill's PLAN phase.
