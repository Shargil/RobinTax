# Form 106 (טופס 106) — Salary and Tax Withholding Confirmation

**What it is**: Annual per-employer summary of salary, social contributions, tax withheld at source (ניכוי מס במקור), and credit points (נקודות זיכוי). One 106 per employer per tax year. The baseline document of every salaried refund — Form 135 / 1301 builds on it.

## Methods

| Method | Confidence | Delivery | Auth | Cost | Last attempt |
|---|---|---|---|---|---|
| ITA personal area — bulk download for last 6 years, all employers | high | immediate | gov.il login (ID + password or smart-card) | free | 2026-06-25 ✓ |
| Employer payroll portal (Michpal / Hilan / Synel / Malam / org HR site) | high | immediate | per-employer SSO / portal login | free | — |
| Direct request to employer HR / payroll | medium | days (manual) | none | free | — |
| Formal ITA query for inactive/closed employer (פניה לרשות המסים) | medium | weeks | gov.il login + written request | free | — |
| Ministry of Labor / labor court (employer non-compliant or insolvent) | low | months | written claim | free | — |

> Confidence reflects general reliability, not user-specific success. The ITA bulk path only contains 106s that the employer actually reported to שע"מ — most large employers comply, but tiny employers or off-the-books pay may be missing and require the employer-direct fallback.

## Login difficulty

**Relay this before the first connection to רשות המיסים (get-doc §2 PLAN).** The ITA login is the hardest gate in the whole flow — set expectations before the window opens:

- **SMS OTP latency** — the code from רשות המיסים can take more than a minute to arrive. The flow's 5-minute login window accommodates this; tell the user up front so they don't request a second code.
- **First-time signup (first-timers only)** — after the OTP, the site asks weird-hard identity-verification questions (driver's license, recent banking, past tax data), with limited attempts before lockout. Returning users skip this — warn first-timers so they're mentally prepared.

## Where to obtain

### Primary: ITA personal area (אזור אישי ברשות המסים)

Since **6 July 2023**, the ITA's personal area exposes every Form 106 the employer reported to שע"מ, for **the last 6 tax years, across all employers** — without needing to chase each employer separately. As of 2026 the open window is **2020–2025**, exactly the lookback window for a refund claim. This is the strongly preferred path for any multi-year, multi-employer request.

- Service page: <https://www.gov.il/he/service/itc-106>
- Logged-in entry: <https://secapp.taxes.gov.il/logon/LogonPoint/tmindex.html>
- After login → income-tax landing page → the 106 link sits at the **bottom-left** of the page.

**Caveat**: The bulk feed depends on the employer having transmitted the 106 to שע"מ. For an employer that didn't report (rare for medium/large companies; not rare for tiny employers or NPOs), the year will be absent from the ITA list and must be obtained via one of the per-employer methods below.

### Secondary: Employer payroll portal

Most Israeli salaried jobs hand 106 production to one of a small set of payroll vendors. The employee logs into the vendor portal (often SSO'd from the employer) and downloads 106s for any year the employer subscribed. Common vendors:

- **Michpal (מיכפל)** — used by many mid-size companies; portal at the employer-branded URL.
- **Hilan (הילן)** — large enterprises and public sector.
- **Synel (סינל)** — common in retail, hospitality, healthcare.
- **Malam (מלם)** — public sector and large enterprises.
- **Government employee portals** — e.g. the Ministry of Education teacher portal at <https://poh.education.gov.il/administrative/salary/106-form/> exposes 106 directly.

Useful only when ITA doesn't have a specific year or as a sanity-check on amounts.

### Tertiary: Direct request to HR / payroll

Every employer is legally required to issue Form 106 by **31 March of the following tax year** (אישור על משכורת וניכוי מס — תקנות מס הכנסה). If the year is missing from ITA and the payroll portal is gone (e.g. the user left the company), email or call HR / חשבי שכר and request a copy.

### Fallback: Inactive / closed employer

When the company is closed or HR is unreachable AND the ITA list doesn't contain the year:

1. Formal written request to the employer's last-known address with proof of employment (תלוש משכורת, חוזה).
2. If still no response — complaint to the **Ministry of Labor wage-protection unit** (מינהל הסדרה ואכיפה — אגף השכר) and/or a claim in the labor court.
3. ITA itself can sometimes reconstruct the 106 from שע"מ records on formal request, even when the employer didn't push the file to the personal area.

## Playbook — ITA personal area (bulk)

**Implemented as a Smart Replay flow** at [`Collector/skill/src/flows/ita.gov.il.ts`](../skill/src/flows/ita.gov.il.ts).

The flow file is the executable, source-of-truth spec for the click sequence — it handles the 7-year loop (current year + 6 back), multi-employer rows per year, the ITA SPA's accordion expand/collapse pattern, post-login polling (5-min cap), and the base64-in-JSON PDF capture (ADR-002 hybrid: UI click for consent, response listener for the bytes). PDFs land at `Collector/skill/downloads/ita/106__<year>[_<n>].pdf`. To inspect, edit, or debug the click sequence, read [`flows/ita.gov.il.ts`](../skill/src/flows/ita.gov.il.ts) directly.

The prose above (Methods, Where to obtain, Caveats) is the human-readable doc the agent reads to understand *what* this document is; the flow file is *how* the agent fetches it. When get-doc handles `form-106`, it routes through the [Smart Replay MCP server's `replay({site: "ita"})`](../skill/src/server.ts) tool — no LLM tokens on the happy path. Only on flow failure does the get-doc skill fall through to its LLM-driven exploration loop.

## Playbook — Employer payroll portal

_Per-vendor playbooks (Michpal, Hilan, Synel, Malam) will be split into their own subsections after first contact. Each one has a different login flow and different "annual 106" link — generalizing before seeing them risks getting it wrong._

## Same-session opportunities

While authenticated in the ITA אזור אישי for the 106, other refund-relevant things on the same portal are reachable in the same session — cheaper to check now than to re-auth later. Offered by get-doc §3b after a successful 106 fetch.

- **Prior-year refund / balance status (החזרי מס ויתרות משנים קודמות)** — *oracle signal, not a downloadable doc.* The personal area surfaces pending refunds, credits, and balances רשות המסים already holds for prior tax years. Reachable from the same אזור אישי landing as the 106 link. Worth a peek for the years in the user's filing scope: it tells us whether a refund is already queued or a balance is owed before the Calculator runs. Feeds the **Calculate** stage as a cross-check, not the document collection. **Intake-linked to §6 FILING SCOPE** — if the user picked years to check, a "no" to grabbing it in-session does NOT drop it; the Calculate stage still checks those years.

> Scope note (v1): only the prior-year refund-status peek is offered here. Donation receipts (§46) are also reachable in-session, but stay out until the `donations` branch graduates from its v2 stub (`tax-rule: none`).

## Caveats

- **The 6-year window is rolling.** A 106 for tax year 2019 is no longer in ITA as of 2026 even though some 6-year lookbacks (e.g. for refund) historically included it via case-by-case extensions. Don't promise older years from this path.
- **Employer-name spelling mismatches**: ITA shows the employer's legal name (ח.פ.-registered), which may not match how the user remembers the job ("the startup" → "XYZ Technologies Ltd."). Resolve by ת.ז. + year + amount, not by name alone.
- **Months-worked check**: 106 lists חודשי עבודה — relevant for credit-point math. If a 106 shows partial-year (e.g. 6 months), the user probably had another employer that year — go look for a second 106.
- **Pension and credit-point fields**: the 106 also carries the pension-deposit totals that feed Form 135. Don't treat the 106 purely as a salary summary.
- **2026 reform note**: digital donation-receipt rule starts 1/1/2026 (Section 46) — unrelated to 106, but mentioned often in the same refund-prep blog posts; do not conflate.
- **Login is hard** — OTP latency + first-time identity-verification gauntlet. Promoted to its own `## Login difficulty` section above (surfaced before connection per get-doc §2).

## Related

- [knowledge-base: tax-refund-documents-salaried.md §0.1](../../.claude/skills/knowledge-base/tax-refund-documents-salaried.md) — catalog entry this playbook implements.
- [knowledge-base: tax-refund-salaried.md](../../.claude/skills/knowledge-base/tax-refund-salaried.md) — the Form 135 / refund process that consumes the 106s.
