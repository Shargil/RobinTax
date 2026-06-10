# Soldier (§39A discharged-soldier credit)

**Profile key:** `soldier`
**Status:** v1
**Order:** 3

## Gate
**Question:** "Did you serve in the IDF or national service (שירות לאומי / אזרחי)?"
**Options:** Yes | No | I don't know
**Open follow-ups on:** Yes, I don't know

## Follow-ups
- **Key:** `discharge_date` — "Roughly when were you discharged? (month + year is enough)" — free-text. Reason: the §39A 36-month eligibility window starts the month *after* discharge, so we need the date to pro-rate years correctly.
- **Key:** `service_length_band` — "How long did you serve?" Options: `Less than 12 months` | `12–21 months` | `22+ months (long service)` | `I don't know`. Reason: 2 pts/year vs 1 pt/year vs 0 ineligible depends on the band; see [`Calculator/rules/types.ts`](../../Calculator/rules/types.ts) `SoldierPointsRule`.

## Seeds

- **Docs (when Yes):** `idf-discharge-certificate` (Form 830) for any filing year that overlaps the 36-month eligibility window.
- **Docs (when unknown):** `idf-discharge-certificate` — pessimistic include. If the user never served, the IDF portal will say so and `get-doc` reports back; cost is one wasted check, value is catching a missed 2-points-per-year credit.
- **Calculator rule keys fed:** `soldier_points`
