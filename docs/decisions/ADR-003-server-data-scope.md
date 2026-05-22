# ADR-003: Server data scope — generated forms and calc results only; never credentials or bank info

**Date:** 2026-05-16
**Status:** accepted

## Context

We need data on our server for two reasons: (a) billing — knowing how much refund we generated for the user so we can charge our cut, and (b) product improvement — understanding where users get stuck. But the trust posture from [ADR-001](ADR-001-no-credential-proxy.md) forbids us from being a custodian of sensitive credentials or banking information.

## Decision

The RobinTax server receives:

- Generated forms (e.g. Form 135 output).
- Tax calculator results.
- Non-sensitive interaction data needed for billing and product improvement.

The server **never** receives:

- ITA login credentials.
- Banking information.

Bank-account fields on Form 135 are populated **only on the user's machine, locally, at the moment of submission to the Israel Tax Authority**. They are not stored anywhere persistent beyond the submission moment, and they never cross the wire to us.

## Why

- Enables billing (we can see refund amount → invoice the user) and product improvement (we can see where flows fail), without becoming a custodian of credentials or banking data.
- Preserves the two non-negotiables from [ADR-001](ADR-001-no-credential-proxy.md): "no spam, no risk."

## Alternatives considered

- Bank fields collected once and stored on our server for repeat use — rejected because it makes us a custodian of banking data, breaking the trust posture.
- Zero server-side data — rejected because we cannot bill without knowing refund amount, and we cannot improve the product without seeing failure points.

## Consequences

- Easier: data-breach blast radius is small; the worst-case leak is anonymized form contents and calc results, not credentials or bank details.
- Harder: every new server-side data field must be reviewed against this ADR. The default answer to "should we collect X" is no.
- Tradeoff accepted: we re-collect bank-account info every submission from the user inside the extension, rather than caching it.

## Related

- [ADR-001](ADR-001-no-credential-proxy.md) — the underlying trust posture.
