---
section: 11
slug: settlement-11
status: active
rule_key: settlement_rule
last_verified: 2026-06-20
verified_against: [madrich-2024, madrich-2025, kolzchut-section-11, settlements-nevo-2024, settlements-employers-2025]
---

# §11 — Qualifying-Settlement Discount (זיכוי לתושבי יישוב מזכה / זיכוי לתושבי פריפריה)

## TL;DR
A **NIS amount equal to `rate × eligible-personal-effort income (capped)`** subtracted from income tax for residents whose **center of life (מרכז חיים)** is in a published qualifying settlement. **Per-settlement** rate (typically 7%–20%) and income ceiling (₪146,640 – ₪267,840 at 2024–2025 values). Pro-rated linearly by qualifying months / 12. Requires **12 consecutive months** of residency in a qualifying settlement (which may span tax years; once cleared, partial-year mid-move years are pro-rated). Eilat is a **separate statute** (Free Trade Zone Eilat Law §11) with its own 10% rate, its own ceiling, and an "income produced in Eilat" requirement — modeled here under the same engine path but flagged in `## Edge cases`.

## The law
- **Statutes:**
  - Income Tax Ordinance §11 (`פקודת מס הכנסה — סעיף 11`) — the qualifying-settlement discount for periphery residents.
  - Free Trade Zone Eilat Law §11 (`חוק אזור סחר חופשי באילת — סעיף 11`) — Eilat's separate 10% discount.
- **Hebrew name:** זיכוי ממס הכנסה לתושבי יישוב מזכה (גם: זיכוי לתושבי פריפריה / יישוב מוטב).
- **Plain English:** If your center of life (מרכז חיים) is in a settlement on the annual ITA list, your income from personal effort (salary, pension, self-employment, severance) gets a discount on tax — `rate × min(personal-effort income, per-settlement ceiling)` NIS off your tax, pro-rated by qualifying months in the tax year. Never makes tax negative.

## Sources
| Source | Where | Last fetched | Role |
|---|---|---|---|
| Kolzchut | https://www.kolzchut.org.il/he/זיכוי_ממס_הכנסה_לתושבים_בפריפריה | 2026-06-20 | Primary cross-check |
| Kolzchut (archive) | `Calculator/rules/sources/_shared/kolzchut-section-11-periphery.html` | 2026-06-05 | Anchors `settlementDiscount()` pro-rata behaviour |
| ITA Madrich 2024 | `Calculator/rules/sources/2024/guide-individuals-2024.pdf` | 2026-06-03 | Statutory + full list (487 rows) |
| Nevo annex 2024 | `Calculator/rules/sources/2024/settlements-nevo-2024.html` | 2026-06-03 | Full §11 list with priority groups |
| ITA settlements procedure 2025 | `Calculator/rules/sources/2025/settlements-procedure-2025.pdf` | 2026-06-03 | 2025 residency-certification procedure |
| ITA employers info 2025 | `Calculator/rules/sources/2025/settlements-employers-2025.pdf` | 2026-06-03 | 2025 rule + war-evacuation extension |

## Eligibility

**Gate (all required):**
1. The taxpayer's **center of life (מרכז חיים)** is in a settlement on the ITA list for that tax year. (Owning property + commuting from elsewhere does NOT qualify — kolzchut example: worker living in Tel Aviv with a Kiryat Shmona rental flat is not eligible.)
2. **12 consecutive months** of residency cleared (may aggregate across qualifying settlements if continuous and may span tax years). The first 12 months trigger eligibility; benefit is then collected pro-rated for the months actually lived there in each tax year.
3. The income claimed is **from personal effort (הכנסה מיגיעה אישית)** — salary, pension, self-employment, severance, kufot gemel distributions.

**Per-settlement parameters:**

| Field | Where | Source |
|---|---|---|
| `rate` (0.07 … 0.20 typical) | `Calculator/rules/settlements/<YYYY>.ts` per row | Annual ITA notice |
| `income_ceiling_nis` (₪146,640 … ₪267,840 typical) | `Calculator/rules/settlements/<YYYY>.ts` per row | Annual ITA notice |
| Fallback ceiling | `Calculator/rules/<YYYY>.ts → settlement_rule.value.max_income_ceiling_nis` | Used only if a settlement row has no per-row ceiling |

The per-settlement values are too large to embed in this spec (≈487 rows for 2024, similar for 2025) — the year-level shared values (`settlement_rule.value`) are the drift contract; the per-settlement table is audited separately via `Calculator/Tests/30 Questions/`.

## Edge cases
- **Center-of-life test, not property ownership** — owning a home in a qualifying settlement while actually living elsewhere does NOT qualify. The test is `מרכז חיים`, not registration or address.
- **Mid-year aggregation across qualifying settlements** — `4 months in A (rate 11%) + 8 months in B (rate 14%)` = full 12 qualifying months; benefit aggregates as `¼ × A's annual benefit + ¾ × B's annual benefit`. Engine: requires the user to model this as two separate runs or as the dominant settlement weighted-average (LIMITATION — flagged in `Open questions`).
- **Personal-effort income only (יגיעה אישית)** — rental, interest, and dividend income are explicitly excluded from the eligible base. Engine currently uses `taxable_ordinary` (CONFLICT — see § Verification log).
- **Eilat is a separate law** — Free Trade Zone Eilat Law §11 (NOT Income Tax Ordinance §11). 10% rate, ceiling ₪268,560 indexed 2024–2027, applies only to income "produced in Eilat region or Chevel Eilot" (with pension uniquely treated as Eilat-sourced if recipient is Eilat resident). Engine path is shared, but the "produced in Eilat" sourcing test is NOT modeled (CONFLICT — see § Verification log).
- **Settlement removed from list** — residents may continue benefit for the removal year **plus one additional year** if they lived there the full prior year (while on list) and full current year. If re-added the year after removal, no benefit that re-added year.
- **War-evacuation extension (Swords of Iron / חרבות ברזל)** — residents of §11-qualifying settlements who were evacuated during the war keep the benefit on extended timelines: Holit (חולית), Kfar Aza (כפר עזה), Bari (בארי) → through 2026; Nir Oz (ניר עוז) → through 2027-08-31. These are statutory extensions, layered ON TOP of the regular list (per `settlements-employers-2025.pdf`).
- **Stacking** — §11 discount stacks with all other credits and deductions; subtracted from tax alongside credit-points and donation/pension credits.
- **Cannot generate refund beyond tax owed** — discount caps at `gross_tax + surtax`; never produces a refund beyond zero ordinary tax (engine clamps at `max(0, …)`).
- **Retroactive claims** — up to 6 tax years back. Resident from Jan 2015 → cleared 12-month gate Jan 2016 → can claim 2015 (pro-rated) via refund + 2016 onwards via employer Form 101.

## Formula
```
# Eligibility floor (currently relied on caller — engine does not check):
#   center_of_life in qualifying settlement AND
#   12 consecutive months cleared (may span tax years)

found = settlements[name_he]
if not found: return 0

ceiling          = found.income_ceiling_nis ?? year.settlement_rule.max_income_ceiling_nis
eligible_income  = min(taxable_ordinary, ceiling)
months_share     = clamp(qualifying_months, 0, 12) / 12
discount_nis     = eligible_income × found.rate × months_share

# Engine then applies:
#   ordinary_tax = max(0, gross_tax + surtax − credit_amount − donation_credit − discount_nis − pension_credit)
```

## Required documents
| Doc | Form # | Playbook |
|---|---|---|
| Residency certificate (אישור תושבות) | 1312א + council letter | [`Collector/documents/residency-confirmation-section-11.md`](../Collector/documents/residency-confirmation-section-11.md) |
| Form 101 (workplace, current year) | טופס 101 §ח | (handled at employer, not collected) |
| Annual return (past years) | טופס 1301 | (filed; not a collector doc) |

## Worked examples
Each row MUST have a 1:1 test in `Calculator/engine/calculate.test.ts` whose name contains the `[id]` tag. Drift test enforces this.

| id | Scenario | Expected |
|---|---|---|
| `settlement-not-listed` | settlement_he='NotListed', 12 months, taxable 150k | discount 0 |
| `settlement-full-year-cap-below-income` | rate 10%, ceiling 250k, taxable 150k, 12 months | discount 15,000 |
| `settlement-income-above-ceiling` | rate 10%, ceiling 250k, taxable 1M, 12 months | discount 25,000 |
| `settlement-pro-rata-6-months` | rate 10%, ceiling 250k, taxable 150k, 6 months | discount 7,500 |
| `multi-employer-aggregate` | golden multi-employer case; rate 10% × min(100k, 250k) × 12/12 | settlement_discount 10,000 |

## Intake
Read by the `intake` skill walker when the user checks `settlement` in [`Intake/checklist.md`](../Intake/checklist.md). The gate is the checklist check itself ("אני מתגורר/ת או התגוררתי ביישוב מזכה") — the follow-ups below queue under the `Settlement {i}/{N}` prefix.

### Gate
- **Question:** "Do you currently live, or did you live, in a qualifying settlement (יישוב מזכה)?"
- **Options:** Yes | No | I don't know
- **Open follow-ups on:** Yes, I don't know

### Follow-ups
- **`settlement_name`** — Description (`rule_lede`, plain Hebrew, shown above the question): "מי שגר לפחות 12 חודשים רצופים ביישוב מהרשימה המזכה (כמו ירוחם, שדרות או מצפה רמון) מקבל הנחה משמעותית במס. צריך שזה יהיה מרכז החיים שלך — לא רק נכס שאתה מחזיק." Question: "Which settlement did you live in? (Hebrew name as it appears in the ITA list — e.g. ירוחם, שדרות, מצפה רמון)". Free-text Hebrew. Reason: this is the lookup key for `settlements/<YYYY>.ts` (`settlement_he`). Maps to engine input `residency.settlement_he`. **Conditional:** ask only on Gate=Yes.
- **`twelve_month_floor_and_center_of_life`** — "Was that settlement your **center of life (מרכז חיים)** — meaning you actually lived there day-to-day, not just owned property — for **12 consecutive months** at any point? It may span tax years (e.g. moved in Aug 2023 → cleared the 12 months in Aug 2024)." Options: `Yes` | `No — I owned property but lived elsewhere` | `No — less than 12 months total` | `I don't know`. Reason: combines the kolzchut center-of-life carve-out (property ownership alone does NOT qualify — kolzchut Tel Aviv/Kiryat Shmona example) with the 12-consecutive-month statutory floor. Either `No` → branch `n/a`, do not seed cert. The exact per-year `qualifying_months` for the engine is resolved by the residency cert itself, not by self-report.
- **`eilat_resident`** — "Was the settlement Eilat (אילת)?" Options: `Yes` | `No` | `I don't know`. **Conditional:** ask only on `settlement_name` containing "אילת" OR on `I don't know`. Reason: Eilat is a separate statute (Free Trade Zone Eilat Law §11) with an "income produced in Eilat" sourcing test. Flags the row for `## Open questions § Eilat sourcing`.

### Seeds
- On Gate = `No` → branch `no`, do NOT seed any doc.
- On `twelve_month_floor_and_center_of_life ∈ {No — owned elsewhere, No — less than 12 months}` → branch `n/a` (ineligible). Skip seeding.
- On Gate = `Yes` AND `twelve_month_floor_and_center_of_life ∈ {Yes, I don't know}` → seed `residency-confirmation-section-11` (the אישור תושבות from the local council). The cert resolves both the consecutive-month floor and the per-year qualifying-month count.
- On Gate = `I don't know` → always seed the cert. Cheap to verify.
- On `eilat_resident = Yes` → seed cert AND flag `eilat` in profile (calculator currently treats Eilat under the same path; the Eilat-sourcing test is an `Open questions` item).

### Profile key
`settlement`

## Implementation map
| Slice | File |
|---|---|
| Schema (rule) | [`Calculator/rules/types.ts`](../Calculator/rules/types.ts) — `SettlementRule` |
| Schema (per-settlement) | [`Calculator/rules/settlements/types.ts`](../Calculator/rules/settlements/types.ts) — `EligibleSettlement`, `YearSettlements` |
| Year values | [`Calculator/rules/2024.ts`](../Calculator/rules/2024.ts), [`Calculator/rules/2025.ts`](../Calculator/rules/2025.ts) — `settlement_rule` |
| Per-settlement list | [`Calculator/rules/settlements/2024.ts`](../Calculator/rules/settlements/2024.ts), [`Calculator/rules/settlements/2025.ts`](../Calculator/rules/settlements/2025.ts) |
| Math | [`Calculator/engine/calculate.ts`](../Calculator/engine/calculate.ts) — `settlementDiscount()` |
| Tests | [`Calculator/engine/calculate.test.ts`](../Calculator/engine/calculate.test.ts) — `describe('settlementDiscount ...')` |
| Doc playbook | [`Collector/documents/residency-confirmation-section-11.md`](../Collector/documents/residency-confirmation-section-11.md) |
| Checklist entry | [`Intake/checklist.md`](../Intake/checklist.md) → `settlement` |
| Profile key | `<memory>/profile.md` → `settlement` |
| Drift check | [`tax-rule/drift.test.ts`](drift.test.ts) |

## Year values (canonical — TS rule tables MUST mirror this JSON)
This block is the year-level shared rule (`settlement_rule.value`). The per-settlement list is too large to embed in the spec — drift for the list is enforced by `Calculator/Tests/30 Questions/` not by this drift test.
```json
{
  "2024": {
    "max_income_ceiling_nis": 267840
  },
  "2025": {
    "max_income_ceiling_nis": 267840
  }
}
```

## Year-over-year changes
| Year | Change |
|---|---|
| 2024 → 2025 | No change to `max_income_ceiling_nis` (₪267,840 — frozen by Arrangements Law sa161224-4 indexation freeze 2025-2027). Per-settlement list changes annually by ITA notice; the engine reads the list off `settlements/<YYYY>.ts`. War-evacuation extension widens to Holit/Kfar Aza/Bari (→ 2026) + Nir Oz (→ 2027-08-31). |

## Open questions
- **Personal-effort income filter not enforced** — engine uses `taxable_ordinary` as the base. For pure-salaried users this equals personal-effort income, but if a user has rental/interest/dividend ordinary income, the engine over-applies the discount. CONFLICT with statute; safe today because RobinTax v1 is salaried-only, but must be fixed before any non-salaried scope.
- **Eilat sourcing test not modeled** — engine treats Eilat the same as a §11-Ordinance settlement (rate × min(income, ceiling)). The Free Trade Zone Eilat Law §11 actually requires income to be "produced in Eilat region or Chevel Eilot" (with pension uniquely Eilat-sourced if the recipient is an Eilat resident). For a user living + working in Eilat the numbers are identical; for someone resident in Eilat but earning income elsewhere, we'd over-apply. CONFLICT; flag if user is Eilat.
- **12-consecutive-month floor not enforced** — engine trusts `qualifying_months` from the intake. If the user has 6 months in their first year and no prior history, kolzchut says the discount is NOT yet realizable. Intake's `twelve_month_floor` follow-up gates this at intake time but the engine itself does not re-check.
- **Mid-year aggregation across two settlements not modeled** — a user with 4m in A + 8m in B should get `¼ × A's annual + ¾ × B's annual`. Today the input shape `{ settlement_he, qualifying_months }` only carries one settlement. Edge case; rare.
- **Settlement-removed-from-list one-year grace not modeled** — per kolzchut, residents may continue the benefit one year after removal under specific conditions. Engine relies on the `settlements/<YYYY>.ts` list and has no `removed_year` grace logic.
- **2025 settlements list ingestion is partial** — `settlements/2025.ts` has fewer rows than `settlements/2024.ts`. See `Calculator/rules/sources/2025/sources.md` known-gaps: full 2025 Nevo annex still needs to be ingested.

## Verification log
- **2026-06-20** — Initial spec. Folded from `Calculator/rules/types.ts` `SettlementRule` docstring + `calculate.ts` `settlementDiscount()` comment + `Calculator/rules/2024.ts`/`2025.ts` notes + `Collector/documents/residency-confirmation-section-11.md`. Gap-passed against kolzchut (https://www.kolzchut.org.il/he/זיכוי_ממס_הכנסה_לתושבים_בפריפריה, fetched 2026-06-20). Closed gaps: (1) Eilat is a separate statute (Free Trade Zone), (2) personal-effort-income-only requirement, (3) 12-consecutive-month floor, (4) mid-year aggregation across two settlements, (5) settlement-removed grace year, (6) war-evacuation Swords-of-Iron extension specifics (Holit/Kfar Aza/Bari/Nir Oz timelines), (7) center-of-life carve-out (owning property ≠ residing). Conflicts surfaced (not silently patched): engine ignores personal-effort filter; engine ignores Eilat-sourcing test. — Claude
