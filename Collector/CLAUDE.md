# Collector

Drives the user's own Chrome via Playwright + CDP to collect tax-refund documents from external sites (ITA, employer portals, banks, pension funds).

## Boundaries

- Runs inside the user's existing Chrome session — reuses their cookies, profile, and 2FA state.
- **Never** sees ITA credentials or banking fields ([ADR-001](../docs/decisions/ADR-001-no-credential-proxy.md)).
- One flow file per site under `flows/<site>.py`. Sites change independently.

## Stack

- Python — chosen for `playwright codegen --target python` ergonomics.
- Playwright, attached via `connectOverCDP` to the user's existing Chrome on port `9222`.

## Local skills

- `collect-documents` — operational checklist for fetching documents from a site.

## Local decisions

- [ADR-001](decisions/ADR-001-playwright-cdp-attach.md) — Why Playwright + CDP attach to the user's existing Chrome.
