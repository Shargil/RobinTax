# Soldier (§39A discharged-soldier credit)

**Profile key:** `soldier`
**Status:** v1
**Order:** 3

## Gate
**Question:** "Did you serve in the IDF or national service (שירות לאומי / אזרחי)?"
**Options:** Yes | No | I don't know
**Open follow-ups on:** Yes, I don't know

## Follow-ups
- **Key:** `discharge_year` — "What year did you finish שירות חובה?" Ask via `AskUserQuestion` chips, not free-text. Show recent years explicitly (`2024 | 2023 | 2022 | 2021 | 2020`) plus `Earlier (before 2020)` and `I don't know`. Reason: §39A's 3-year window starts the month after discharge, so we use the year to decide whether the cert is even worth fetching (see Seeds rule below).
- **Key:** `service_length_band` — "How long did you serve?" Options: `Less than 12 months` | `12–21 months` | `22+ months (long service)` | `I don't know`. Reason: 2 pts/year vs 1 pt/year vs 0 ineligible depends on the band; see [`Calculator/rules/types.ts`](../../Calculator/rules/types.ts) `SoldierPointsRule`.

## Seeds

The §39A eligibility window is **36 months starting the month after discharge** — practically, the discharge year + the next 3 calendar years can claim. Use this to decide whether to fetch the cert at all:

- **Compute `latest_eligible_year = discharge_year + 3`.** If `latest_eligible_year < min(filing_years)`, the cert can't help any of the user's filing years → branch is `n/a`, **do not seed** the doc. The user spent the time on the question but doesn't burn cycles fetching a useless doc.
- **Otherwise (any overlap):** seed `idf-discharge-certificate` (Form 830) once. The cert covers the whole window; no need to seed per-year.
- **On `discharge_year = I don't know` or `service_length_band = I don't know`:** always seed the cert — pessimistic include. The cert itself reveals the exact dates and length.
- **On gate `unknown` (user wasn't sure they served at all):** always seed. Cheap to check.

**Calculator rule keys fed:** `soldier_points`
