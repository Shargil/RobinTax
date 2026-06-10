# RobinTax

Get Israeli users their tax refund money back, for cheaper, with no spam.

## Service map

- `Collector/` — drives the user's own Chrome via Playwright + CDP to collect tax-refund documents from ITA, employer portals, banks, and pension funds. Runs inside the user's own browser session. Per-document research + playbooks live at [`Collector/documents/`](Collector/documents/).
- `Calculator/` — per-year refund computation. Deterministic math, LLM only at the edges, ITA as the final oracle. Engine ([`Calculator/engine/`](Calculator/engine/)), per-year rule tables ([`Calculator/rules/`](Calculator/rules/) — 2020–2025), and second-check verifier ([`Calculator/verifier/`](Calculator/verifier/)) all built.
- `GTM/` — go-to-market assets.
- `Test/` — test fixtures and harnesses.
- `Users/` — per-user test data.
- `tax_refund_documents_research.md` — long-form research on the refund-document landscape.

## Conventions

- **This repo IS the plugin.** Manifest at [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json), marketplace catalog at [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json). User-facing skills live at [`skills/`](skills/) per the Claude Code plugin spec.
- **Dev workflow:** `claude --plugin-dir .` from the repo root. Plugin skills are namespaced — invoke as `/robintax:robintax`, `/robintax:get-doc`, `/robintax:calc-refund` (the namespace prefix is the plugin name).
- Dev-only meta-skills (not shipped) live at [`.claude/skills/`](.claude/skills/) — currently just `monorepo-mega-skill`.
- Repo-wide ADRs live in [`docs/decisions/`](docs/decisions/); service-local ADRs live in `<service>/decisions/`. Scan filenames before making a new architectural call.
- The product never proxies or stores ITA credentials or bank-account fields. See [ADR-001](docs/decisions/ADR-001-no-credential-proxy.md).
- **Journey state**: each user's standing across the whole refund process (docs → calc → filing) lives in one per-user ledger at `<memory>/journey.md` (`<memory>` = the per-user `~/.claude/projects/<project>/memory/` dir). Any skill that changes user standing reads it at run start and updates it at run end. Contract: [ADR-011](docs/decisions/ADR-011-user-journey-ledger.md).
- **Bundled-asset paths in skills** must use `"${CLAUDE_PLUGIN_ROOT:-.}/Calculator/..."` etc. — the env var is set when installed, falls back to `.` (CWD) when developing with `--plugin-dir .`.

## Available skills (shipped in the plugin)

- `robintax` — **front door.** `/robintax:robintax` resumes the user's tax return: reads the journey ledger, reports standing across all stages (collect → calculate → file), and routes to the next worker skill. Start here. Source: [`skills/robintax/`](skills/robintax/).
- `get-doc` — slash-command-only (`/robintax:get-doc <document>`, or no-arg to resume collection) loop that fetches one of the catalogued tax-refund documents via the user's logged-in Chrome and writes back a sanitized playbook to `Collector/documents/<slug>.md`. Source: [`skills/get-doc/`](skills/get-doc/).
- `calc-refund` — slash-command or `robintax`-routed worker for the **Calculate refund** stage. Computes per-year refund/owe + a file/don't-file recommendation via [`Calculator/engine/`](Calculator/engine/) + [`Calculator/rules/`](Calculator/rules/), second-checking every load-bearing value and human-confirming every bottom line via [`Calculator/verifier/`](Calculator/verifier/). Source: [`skills/calc-refund/`](skills/calc-refund/).
- `monorepo-mega-skill` — **dev-only**, not shipped. How this repo organizes CLAUDE.md, ADRs, and skills. Source: [`.claude/skills/monorepo-mega-skill/`](.claude/skills/monorepo-mega-skill/).
