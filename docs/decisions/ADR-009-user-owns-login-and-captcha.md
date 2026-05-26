# ADR-009: The user always performs login and CAPTCHA themselves

**Date:** 2026-05-22
**Status:** accepted

## Context

RobinTax automates portions of the user's session on ITA and partner portals to collect tax documents. Every automated step is a place we could overreach. Login screens and CAPTCHA challenges are the two surfaces where overreach is most damaging: login is where credentials live (and ADR-001 forbids us touching them), and CAPTCHA is an explicit "is this a real human" signal that a site is allowed to demand.

## Decision

The product **never** automates login flows or CAPTCHA challenges. Both are always performed by the user, manually, in their own browser session. Our automation begins **after** login is complete and only resumes after any CAPTCHA the site presents has been solved by the user.

This holds for every execution model RobinTax ships — Collector and anything that comes later.

## Why

- **Login** — automating it would require either knowing the credentials (forbidden by [ADR-001](ADR-001-no-credential-proxy.md)) or replaying stored auth artifacts, which is a credential-custody problem in disguise.
- **CAPTCHA** — solving CAPTCHAs is a strong signal that we are pretending to be a human. Even if technically possible, doing so makes us a bot in the legal/policy sense and invites bans across every site we touch.
- Drawing the line *here* (not "we don't automate anything risky") gives us a crisp, testable rule: a flow file that contains a login click or a CAPTCHA interaction is broken and must be fixed.

## Alternatives considered

- **Automate login when we have stored OAuth tokens** — rejected; token storage is credential custody with extra steps, and rotates/revokes silently. Not worth the small UX win.
- **Solve image CAPTCHAs via vision LLM** — rejected; technically feasible but reframes us as a bot vendor. Destroys the trust posture for negligible benefit.
- **Pause for login but auto-resume on URL match after CAPTCHA** — kept as the mechanism, *not* as an exception to this rule. The user is still the one performing the CAPTCHA; the automation just watches for completion.

## Consequences

- Easier: clean rule for flow authors — no decision tree about "is this login-adjacent enough to skip?".
- Harder: every flow needs a robust **post-login wait signal** (a DOM/locator that only appears after auth completes) so automation knows when it's safe to resume. Flows must not start on URL match alone.
- Tradeoff accepted: if a site adds a CAPTCHA to a step we previously automated, that flow halts until the user solves it. Acceptable cost.

## Related

- [ADR-001](ADR-001-no-credential-proxy.md) — credential-proxy trust posture this extends.
