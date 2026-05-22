# ADR-001: Never proxy ITA credentials or banking data

**Date:** 2026-05-16 (revised 2026-05-22 to drop extension-specific framing)
**Status:** accepted

## Context

RobinTax drives the user's session through Israeli tax sites and related portals to collect refund documents. The two non-negotiables for users are "no spam" and "no risk." Anything that touches login credentials or routes the session through our servers breaks the trust posture before we ship.

This decision is **execution-model-agnostic** — it holds whether the driver is a Chrome extension, a Playwright-based collector, or anything we build later.

## Decision

1. The product runs on the user's own computer, inside the user's own browser session.
2. It never stores, proxies, or transmits ITA login credentials or banking information.

## Why

- Credentials and bank data never leave the user's machine, so there is nothing for us to leak.
- "No spam, no risk" is the entire promise. A credential-proxy architecture would make us a custodian of those credentials and put us one breach away from destroying the product.

## Alternatives considered

- Server-side scraper with stored credentials — rejected; makes RobinTax a credential custodian and breaks the trust posture.
- Native desktop app that caches credentials locally — rejected; the user can rotate their ITA password and the app silently breaks, with no upside over running inside the user's existing browser session.

## Consequences

- Easier: legal/compliance story, marketing ("we never see your login").
- Harder: all automation logic lives on the client and must be resilient to ITA UI drift; we cannot reproduce a user's session server-side.
- Tradeoff accepted: every execution model we ship must respect this. New mechanisms (e.g. `Collector/`) inherit the constraint, not relax it.

## Related

- [ADR-003](ADR-003-server-data-scope.md) — what *does* cross the wire to our server.
