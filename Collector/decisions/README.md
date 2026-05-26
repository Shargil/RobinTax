# Collector decisions

Decisions scoped to the Collector service. Repo-wide decisions live in `../../docs/decisions/`.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](ADR-001-playwright-cdp-attach.md) | Drive the user's Chrome via Playwright + CDP attach on port 9222 | superseded by [ADR-005](ADR-005-playwriter-chrome-extension.md) |
| [ADR-002](ADR-002-ui-clicking-default-xhr-fallback.md) | Default to UI clicking; fall back to XHR for bulk, summary-only, or multi-doc endpoints | accepted |
| [ADR-003](ADR-003-recording-via-playwright-codegen.md) | Record flows via `playwright codegen` at dev time; no runtime auto-capture | accepted |
| [ADR-004](ADR-004-ts-flow-modules.md) | Per-site TypeScript flow modules; no JSON action store in v1 | accepted |
| [ADR-005](ADR-005-playwriter-chrome-extension.md) | Drive the user's Chrome via the Playwriter extension over `chrome.debugger`; supersedes ADR-001 | accepted |
