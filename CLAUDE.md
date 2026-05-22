# RobinTax

Get Israeli users their tax refund money back, for cheaper, with no spam.

## Service map

- `Collector/` — drives the user's own Chrome via Playwright + CDP to collect tax-refund documents from ITA, employer portals, banks, and pension funds. Runs inside the user's own browser session.
- `GTM/` — go-to-market assets.
- `Test/` — test fixtures and harnesses.
- `Users/` — per-user test data.
- `Where to find documents/` — research notes on where each Israeli tax document lives in ITA / employer / email flows.
- `tax_refund_documents_research.md` — long-form research on the refund-document landscape.

## Conventions

- Repo-wide skills live in [`.claude/skills/`](.claude/skills/) and auto-load every session.
- Repo-wide ADRs live in [`docs/decisions/`](docs/decisions/); service-local ADRs live in `<service>/decisions/`. Scan filenames before making a new architectural call.
- The product never proxies or stores ITA credentials or bank-account fields. See [ADR-001](docs/decisions/ADR-001-no-credential-proxy.md).

## Available repo-wide skills

- `monorepo-mega-skill` — how this repo organizes CLAUDE.md, ADRs, and skills. Use when editing any of them.
- `knowledge-base` — Israeli tax domain knowledge router (refund process, forms 106/135/1301/etc., eligibility, ITA procedures).
