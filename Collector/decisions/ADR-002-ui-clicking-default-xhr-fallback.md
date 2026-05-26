# ADR-002 (Collector): Default to UI clicking; fall back to XHR for bulk, summary-only, or multi-doc endpoints

**Date:** 2026-05-26
**Status:** accepted

## Context

`israeli-bank-scrapers` ([repo](https://github.com/eshaham/israeli-bank-scrapers)) demonstrates a "log in via UI, scrape via XHR" pattern: drive the login form once, then call the site's own JSON endpoints from inside the page context (cookies auto-attach, same-origin, looks identical to the SPA's own traffic). For headless server-side scraping this is 10–100× faster than UI scraping and far less brittle.

For Collector we considered adopting the same pattern and had to pick a default.

## Decision

**Default to UI-driven scraping** — selectors, clicks, `waitForResponse` to capture the resulting payload. This is what Smart Replay records and replays.

**Fall back to background `fetch` (XHR-from-within-page) only when one of these three conditions holds:**

1. **Bulk pagination** — the flow requires walking through hundreds of items (e.g., 6 years of bank transactions one screen at a time). Clicking "next page" 60+ times is silly when a single API call returns the whole range.
2. **Summary-only UI** — the data we need exists only in the API response, not the rendered UI (some banks show summary rows in the table while the JSON has the line-item detail we actually want).
3. **Multi-doc endpoint** — the same endpoint serves several documents and one call gets us all of them, vs. clicking through N separate download links.

Outside those three cases, do not introduce a parallel XHR pathway.

## Why UI clicking is the default

Our context flips most of `israeli-bank-scrapers`'s tradeoffs:

- **The user is watching.** Background `fetch()` calls feel like malware to an anxious taxpayer; visible clicks read as "yes, that's what I would do." For a product whose core promise is "we never touch your credentials" ([Repo ADR-001](../../docs/decisions/ADR-001-no-credential-proxy.md)), invisible API traffic undercuts the narrative even when it's harmless.
- **ADR-010 assumes UI semantics.** Every step has a `reason` and scary steps need y/n consent. "Click 'הורד טופס 106'" reads naturally to the user; "`POST /api/v3/documents/106?token=…`" does not.
- **Speed is not our constraint.** We collect ~6 docs/user once or twice a year. The bottleneck is login + CAPTCHA, not click latency. Saving 30s on a 5-minute flow moves no needle.
- **Mid-flow 2FA / CAPTCHA handling.** ITA throws reCAPTCHA; some banks insert step-up auth between requests. A UI flow handles this naturally (user sees it, resolves it, we resume on a DOM signal per [Repo ADR-009](../../docs/decisions/ADR-009-user-owns-login-and-captcha.md)). An XHR loop dies on a 401 it can't recover from.
- **Dev cost per site.** Recording a UI flow via Smart Replay is minutes. Reverse-engineering each site's CSRF/HMAC/nonce scheme is hours, and many employer portals are ancient ASP.NET with no clean JSON API to call.
- **Auditability.** A screenshot/click trail of what we did with the user's session is stronger evidence — for tax/legal context — than "trust us, we made these requests."

## The hybrid we actually use

Even in the UI-clicking default, capture the response when one is available — the click is for the user, the response is for us:

```python
async with page.expect_response(lambda r: "/api/106" in r.url) as resp_info:
    await page.click('a:has-text("הורד טופס 106")')   # user sees this
resp = await resp_info.value
pdf_bytes = await resp.body()                          # skip DOM parsing
```

This is the [Leumi pattern from `israeli-bank-scrapers`](https://github.com/eshaham/israeli-bank-scrapers/blob/master/src/scrapers/leumi.ts#L756-L771). It keeps the UI legible while giving us the clean payload.

## When to invoke the XHR fallback

When one of the three trigger conditions above clearly applies for a specific site, the per-site collector may switch that flow to direct `fetch`-from-within-page. Document the trigger condition in the per-site collector file so the choice is reviewable. Do not generalize XHR into a parallel pathway across the whole codebase.

## Alternatives considered

- **Pure XHR everywhere (the `israeli-bank-scrapers` approach).** Rejected — wrong defaults for a user-watched, low-frequency, high-trust product.
- **Build both pathways from day one.** Rejected — doubles the surface area and the Smart Replay infrastructure only covers the UI path. Add the XHR pathway per-site as a real need appears.

## Related

- [Collector ADR-001](ADR-001-playwright-cdp-attach.md) — Playwright + CDP attach to the user's Chrome.
- [Repo ADR-009](../../docs/decisions/ADR-009-user-owns-login-and-captcha.md) — user owns login + CAPTCHA; flows resume on DOM signals.
- [Repo ADR-010](../../docs/decisions/ADR-010-explain-and-gate-scary-actions.md) — every step has a `reason`; scary steps gated.
