# Academic degree (§40C — degree credit points)

**Profile key:** `degree`
**Status:** v1 — promoted from v2-stub on 2026-06-10 after learning the §40C reform (2023+) extends the credit to multi-year (was: 1 year only) — meaningful payoff for users filing 2020–2025.
**Order:** 5

## Rules summary (so the gate questions make sense)

Per §40C, after the 2023 reform (sources: kolzchut, ITA Form 119 instructions):

| Degree | Completed pre-2023 (2014–2022) | Completed 2023+ |
|---|---|---|
| תואר ראשון (BA/BSc) | 1 pt × 1 year (choice of year-after or year+2) | 1 pt × N years where N = years of study, capped at 3 |
| תואר שני (MA/MSc) | 0.5 pt × 1 year | 0.5 pt × N years, capped at 2 |
| תואר שלישי במסלול ישיר | n/a as separate rule | 0.5 pt × 2 years post-completion |
| לימודי מקצוע / תעודת מקצוע (teaching, technician, paramedic, etc.) | 1 pt × N years, capped at 3 | same |
| Medicine / law / dentistry — internship deferral | benefits start post-internship instead of post-graduation | same |

Credit always starts the tax year **after** completion (unless internship deferral applies).

## Gate
**Question:** "Did you complete an academic degree (תואר אקדמי) or professional certification (לימודי מקצוע / תעודת מקצוע) at any point — even years before your filing window? Recent graduations matter most, but post-2023 BAs get 3 years of credit so older graduations can still help."
**Options:** Yes | No | I don't know
**Open follow-ups on:** Yes

**On `no`** → branch state `no`, no doc seed.
**On `unknown`** → unusual; treat as `no` (degree status is something the user knows). Don't pessimistically seed; Form 119 requires actual diploma details.

## Follow-ups (only if gate = `Yes`)

### Q1 — which degree(s)
**Key:** `degrees_held`
**Question:** "Which degree(s) did you complete? Pick all that apply."
**Options (multiSelect, `AskUserQuestion`):**
- תואר ראשון (BA/BSc)
- תואר שני (MA/MSc)
- תואר שלישי / רפואה / רפואת שיניים / רוקחות
- תעודת הוראה / הנדסאי / טכנאי (professional)

### Q2 — completion year per degree
**Key:** `degree_completion_years`
**Question:** Free-text. "For each degree you picked, what year did you complete it? Format: `BA 2022, MA 2024`. Year-only is enough."
Free-text rather than chips because multi-degree disclosure doesn't fit a 4-option panel.

### Q3 — study duration (only relevant for post-2023 graduates)
**Key:** `degree_study_years`
**Question:** Free-text. "For any degree you completed in 2023 or later, how many years did the studies take? (Pre-2023 graduations get the credit for 1 year regardless, so this is only needed for recent grads.)"

## Seeds

- **Doc (when gate = Yes):** `form-119-degree` (טופס 119 — בקשה להקלה במס ליחיד הזכאי לתואר אקדמי/תעודת מקצוע).
- **Filing-year scoping:**
  - **Pre-2023 graduates:** credit applies to **1 of**: completion-year+1 or completion-year+2. If neither year is in the user's declared filing window → branch is `n/a`, don't seed.
  - **Post-2023 BA graduates:** credit applies to completion-year+1 through completion-year+(study_years), capped at +3. Seed if any of those years are in the filing window.
  - **Post-2023 MA graduates:** same logic, capped at +2.
  - **Post-2023 PhD-direct:** seed if completion-year+1 or +2 are in the filing window.
  - **Professional / teaching:** seed if completion-year+1 through completion-year+(study_years, max 3) overlap the filing window.
  - **Always seed if `unknown` study_years and gate = Yes** — pessimistic include; Form 119 + the diploma carry the dates.

**Manual step until playbook exists:** Form 119 has no `get-doc` playbook yet — `Collector/documents/form-119-degree.md` is unwritten. Until then, surface as a manual instruction in the wrap-up: "Download Form 119 from gov.il (search 'טופס 119'), fill in your degree details (diploma + completion date), and drop it in `~/Downloads/RobinTax/`. Form: https://www.gov.il/BlobFolder/service/itc119/he/Service_Pages_Income_tax_annual-report-2024_itc119-2024.pdf"

**Calculator rule keys fed:** `degree_points` — but see the bug note below; `Calculator/rules/2024.ts` and `2025.ts` currently encode `eligible_years_post_completion: 1` (the pre-reform rule). Calculator needs the per-degree-year-and-type rule before this branch's value can fully flow through.

## Known bugs (Calculator)

- [`Calculator/rules/2024.ts:102`](../../Calculator/rules/2024.ts) and [`Calculator/rules/2025.ts:97`](../../Calculator/rules/2025.ts) both have `eligible_years_post_completion: 1` — that's the pre-2023 rule. Per §40C reform, post-2023 BA grads get up to 3 years and MA grads up to 2. The `DegreePointsRule` type itself in `Calculator/rules/types.ts` may need extending to encode per-degree-level year caps (or a `study_years_multiplier` flag) before the engine can compute correctly. Track via Calculator's sign-off workflow ([`Calculator/decisions/ADR-002`](../../Calculator/decisions/ADR-002-year-versioned-rule-tables.md)).
