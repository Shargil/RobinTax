---
section: 39A
slug: soldier-39a
status: active
rule_key: soldier_points
last_verified: 2026-06-20b
verified_against: [madrich-2024, madrich-2025, kolzchut]
---

# §39A — Discharged Soldier Credit (חייל משוחרר ומסיים שירות לאומי-אזרחי)

## TL;DR
Annual credit points (נקודות זיכוי) against income tax for the first 36 months after completing IDF, national, or civilian service. **2 pts/year** for long service, **1 pt/year** for short (but ≥12m) service. Reduces tax owed; never generates a refund beyond zero. At 2026 values: max lifetime benefit ≈ **₪8,712** (1 pt × 36m) or **₪17,424** (2 pt × 36m).

## The law
- **Statutes:**
  - Income Tax Ordinance §39A (`פקודת מס הכנסה — סעיף 39א`) — defines the credit.
  - Law for Absorption of Discharged Soldiers §1 (`חוק קליטת חיילים משוחררים — סעיף 1`) — defines who counts as a "discharged soldier" for §39A purposes.
- **Hebrew name:** זיכוי לחייל משוחרר ולמסיים שירות לאומי-אזרחי.
- **Plain English:** Anyone who completed mandatory IDF service, national service (שירות לאומי), or civilian service (שירות אזרחי) **and** is employed (שכיר) or self-employed (עצמאי) paying income tax on work/business income gets credit points for the 36 months following discharge.

## Sources
| Source | Where | Last fetched | Role |
|---|---|---|---|
| Kolzchut | https://www.kolzchut.org.il/he/נקודות_זיכוי_מס_הכנסה_לחיילים_משוחררים_ומסיימי_שירות_לאומי-אזרחי | 2026-06-13 | Primary cross-check |
| ITA Madrich 2024 | `Calculator/rules/sources/2024/guide-individuals-2024.pdf`, lines 4298–4325 | 2026-06-03 | Statutory interpretation |
| ITA Madrich 2025 | `Calculator/rules/sources/2025/` | (archived) | Statutory interpretation |

## Eligibility

**Gate (both required):**
1. Completed IDF mandatory service, national service (שירות לאומי), OR civilian service (שירות אזרחי).
2. Employed (שכיר) or self-employed (עצמאי) with income tax owed on work / business income. (No work-income tax → nothing to apply the credit against.)

**Long-service threshold (for 2 pts/year tier) depends on track:**

| Track | Long-service threshold |
|---|---|
| IDF — male | ≥23 months |
| IDF — female | ≥22 months |
| National service (M/F) | ≥24 months |
| Civilian service (M/F) | ≥24 months |

**Eligibility floor:** ≥12 months of service for any benefit.

**Window:** 36 consecutive months, starting the month **AFTER** discharge.

## Edge cases
- **Medical / disability early discharge under 12m** — treated as completed 12m → 1 pt/year (short-service tier). Covers both medical (שחרור מקדם מטעמי בריאות) and disability (נכות) early discharges. Source: kolzchut, "חייל ששוחרר שחרור מקדם לפני שהשלים 12 חודשי שירות, ייחשב כמי שהשלים 12 חודשי שירות".
- **Multiple service types** (e.g. IDF + national) — combine into total service months. Engine handles via `service_months_full + service_months_partial`.
- **Reserve service (שירות מילואים)** — counts toward total service when combined with compulsory service (per kolzchut "combined service length counts").
- **Yeshiva / hesder pathway (הסדר)** — points based on total service length from conscription through discharge. Same thresholds apply; the IDF track applies (not the national-service 24m threshold) since hesder soldiers are IDF.
- **National & civilian thresholds are 24m for both genders** — do NOT use the IDF 23/22 split.
- **Stacking** — §39A credit points stack with all other credit points the user is entitled to (standard 2.25/2.75 resident points, immigrant §35, degree §40, etc.). They share the single tax-liability cap; once tax owed hits zero, additional points are wasted.
- **Cannot generate refund beyond tax owed** — pure credit, not a payment. נקודות זיכוי מקטינות את גובה מס ההכנסה שצריכים לשלם, ולכל היותר עד למצב שבו גובה המס הנדרש הוא אפס.
- **Retroactive claims** — general ITA rule allows up to 6 tax years back.

## Formula

```
raw_service       = service_months_full + service_months_partial
effective_service = max(raw_service, 12) if early_discharge_medical else raw_service
if effective_service < 12: return 0

long_threshold = {
  'idf' + male:     23,
  'idf' + female:   22,
  'national':       24,
  'civilian':       24,
}

annual_pts      = 2 if effective_service >= long_threshold else 1
per_month       = annual_pts / 12
window          = [month_after_discharge, month_after_discharge + 35]   # inclusive
eligible_months = overlap(window, [Jan tax_year, Dec tax_year])

pts = eligible_months × per_month
```

## Required documents
| Doc | Form | Playbook |
|---|---|---|
| IDF discharge cert (תעודת שחרור) | טופס 830 | [Collector/documents/idf-discharge-certificate.md](../Collector/documents/idf-discharge-certificate.md) |
| National service completion | (placement org issues) | *not built yet* |
| Civilian service completion | (placement org issues) | *not built yet* |

## Worked examples
Each row MUST have a 1:1 test in `Calculator/engine/calculate.test.ts` whose name contains the `id`. The drift test enforces this.

| id | Scenario | Expected |
|---|---|---|
| `outside-window` | M, 30m IDF, Jan 2020 discharge, claim 2024 | 0 |
| `floor` | M, 10m IDF, Dec 2024 discharge, claim 2025 | 0 |
| `kolzchut-b1` | M, 30m IDF, Jul 2022 discharge, claim 2025 (Jan–Jul = 7m × 2/12) | 7/6 |
| `madrich-b1` | M, 30m IDF, Aug 2021 discharge, claim 2024 (Jan–Aug = 8m × 2/12) | 8/6 |
| `full-year` | M, 24m IDF, Dec 2024 discharge, claim 2025 | 2 |
| `short-15m` | M, 15m IDF, Dec 2024 discharge, claim 2025 | 1 |
| `idf-female-22m-boundary` | F, 22m IDF, Dec 2024 discharge, claim 2025 | 2 |
| `idf-female-21m-short` | F, 21m IDF, Dec 2024 discharge, claim 2025 | 1 |
| `medical-early-discharge` | M, 8m IDF + medical, Dec 2024 discharge, claim 2025 | 1 |
| `national-23m-short` | M, 23m national service, Dec 2024 discharge, claim 2025 | 1 (24m threshold) |
| `national-24m-long` | F, 24m national service, Dec 2024 discharge, claim 2025 | 2 |

## Intake
This section is read by the `intake` skill walker when the user checks `soldier` in [`Intake/checklist.md`](../Intake/checklist.md). The gate is the checklist check itself — the follow-ups below are the queue the walker fires under the `Soldier {i}/{N}` prefix.

### Gate
- **Checklist label (Hebrew, user-facing):** `שירתתי בצה"ל, בשירות לאומי או בשירות אזרחי (גם שירות חלקי)`. The "(גם שירות חלקי)" parenthetical is load-bearing — it stops users who served <full mandatory term (e.g. 13 months, or any early discharge) from self-excluding. §39A pays out for any ≥12-month service plus the medical-discharge carve-out.
- **Options:** Yes | No | I don't know
- **Open follow-ups on:** Yes, I don't know

### Follow-ups
- **`service_track`** — Description (`rule_lede`, plain Hebrew, shown above the question): "מי ששירת בצה״ל, בשירות לאומי או בשירות אזרחי (התנדבות בבתי חולים, מד״א, רווחה וכד׳) מקבל נקודות זיכוי ממס בשלוש השנים שאחרי השחרור. שירות ארוך = יותר נקודות. פחות משנה — אין הטבה (אלא אם השחרור היה רפואי)." Question: "Which track did you serve in?" Options: `IDF (צה״ל)` | `National service (שירות לאומי)` | `Civilian service (שירות אזרחי)` | `I don't know`. Reason: long-service threshold differs (24m for national/civilian vs 23/22 for IDF). Maps to engine input `service_track`.
- **`discharge_year`** — "Were you discharged in 2017 or later?" Options: `Yes (2017 or later)` | `No (before 2017)` | `I don't know`. Reason: the §39A window is 36 months from discharge; given RobinTax's 6-year retro filing horizon (earliest filable tax year = `current_year − 6`), the earliest discharge with any remaining eligibility is **January 2017** (window Feb 2017 → overlaps tax year 2020 by 1 month). Anything earlier is a hard `n/a`. Asking exact year is product clutter — the cert resolves year + month. Cutoff is `current_year − 9` and MUST be re-checked when the filing horizon advances (2027 → 2018 cutoff, etc.). Maps to a seed-gate only; engine inputs `discharge_year` + `discharge_month` come from the cert.
- **`service_length_band`** — Options: `Less than 12 months` | `12–21 months` | `22+ months` | `I don't know`. Reason: drives the long/short/ineligible tier. Maps to engine input `service_months_full` (walker uses band-representative months for the seed: `<12 → 8`, `12–21 → 15`, `22+ → 24`; the cert resolves the exact month count for the final calc). The 22+ tier is "long service" internally but that label is jargon — keep the option text bare.
- **`medical_early_discharge`** — **Conditional:** ask only if `service_length_band ∈ {Less than 12 months, I don't know}`. Options: `Yes` | `No` | `I don't know`. Reason: §39A medical carve-out treats sub-12m medical discharge as 12m. Maps to engine input `early_discharge_medical: true` on `Yes`.

### Seeds
- On `discharge_year = No (before 2017)` → branch is `n/a`, do **not** seed the doc.
- On `discharge_year ∈ {Yes (2017 or later), I don't know}` → seed `idf-discharge-certificate` (Form 830) once. The cert covers the whole window and resolves exact year + month.
- On `service_length_band = I don't know` → always seed (pessimistic — the cert reveals the truth).
- On gate `unknown` (user wasn't sure they served) → always seed. Cheap to check.
- On `service_length_band = Less than 12 months` AND `medical_early_discharge = No` → `n/a`, do not seed.
- On `service_length_band = Less than 12 months` AND `medical_early_discharge ∈ {Yes, I don't know}` → seed (cert proves the medical-discharge carve-out).

### Profile key
`soldier`

## Implementation map
| Slice | File |
|---|---|
| Schema | [`Calculator/rules/types.ts`](../Calculator/rules/types.ts) — `SoldierPointsRule` |
| Year values | [`Calculator/rules/2024.ts`](../Calculator/rules/2024.ts), [`Calculator/rules/2025.ts`](../Calculator/rules/2025.ts) — `soldier_points` |
| Math | [`Calculator/engine/calculate.ts`](../Calculator/engine/calculate.ts) — `soldierPoints()` |
| Tests | [`Calculator/engine/calculate.test.ts`](../Calculator/engine/calculate.test.ts) — `describe('soldierPoints ...')` |
| Doc playbook | [`Collector/documents/idf-discharge-certificate.md`](../Collector/documents/idf-discharge-certificate.md) |
| Checklist entry | [`Intake/checklist.md`](../Intake/checklist.md) → `soldier` |
| Profile key | `<memory>/profile.md` → `soldier` |
| Drift check | [`tax-rule/drift.test.ts`](drift.test.ts) |

## Year values (canonical — TS rule tables MUST mirror this JSON)
```json
{
  "2024": {
    "points_per_year_long_service": 2,
    "points_per_year_short_service": 1,
    "min_service_months_male_long": 23,
    "min_service_months_female_long": 22,
    "min_service_months_national_long": 24,
    "min_service_months_eligibility": 12,
    "eligibility_window_months": 36
  },
  "2025": {
    "points_per_year_long_service": 2,
    "points_per_year_short_service": 1,
    "min_service_months_male_long": 23,
    "min_service_months_female_long": 22,
    "min_service_months_national_long": 24,
    "min_service_months_eligibility": 12,
    "eligibility_window_months": 36
  }
}
```

## Monetary point values per year
The nominal value of 1 credit point lives in `point_value_annual` and `point_value_monthly` on each year-rule file — NOT in `soldier_points`. §39A only owns the *count* of points; the multiplier is shared with every other points-based credit.

| Year | 1 pt / month | 1 pt / year | 2 pts / month | 2 pts / year | Source |
|---|---|---|---|---|---|
| 2024 | per `2024.ts point_value_monthly` | per `2024.ts point_value_annual` | ×2 | ×2 | `Calculator/rules/2024.ts` |
| 2025 | per `2025.ts point_value_monthly` | per `2025.ts point_value_annual` | ×2 | ×2 | `Calculator/rules/2025.ts` |
| 2026 (not yet a filing year) | ₪242 | ₪2,904 | ₪484 | ₪5,808 | kolzchut 2026 — not yet ingested into a year file |

## Year-over-year changes
| Year | Change |
|---|---|
| 2024 → 2025 | No statutory change. Indexation applies to point value (`point_value_annual`), not to §39A thresholds. |

## Open questions
- National & civilian service completion playbooks not yet built — collector currently only handles IDF Form 830.
- 2026 year values not yet captured — ship a `"2026":` block in the canonical JSON when filing 2026.

## Verification log
- **2026-06-20b** — Intake UX bug-fixes after §11 approval review with Yam. (1) Gate label widened from "סיימתי שירות חובה" (only completers) to "שירתתי בצה״ל, בשירות לאומי או בשירות אזרחי (גם שירות חלקי)" — the old label caused users with <full-term service (e.g. 13 months, medical/compassionate/early discharge) to self-exclude despite being §39A-eligible. Patched `Intake/checklist.md` and `### Gate` here. (2) `discharge_year` follow-up collapsed from 7-chip year picker to binary "2017 or later? yes/no/unknown" — exact year is product clutter (cert resolves it), and the old "Earlier (before 2020)" bucket silently dropped potentially-eligible 2017–2019 discharges. Cutoff = `current_year − 9`; re-check when filing horizon advances. Seeds section updated to reflect the new shape. No law/formula/value change. — Claude
- **2026-06-20** — Skill-drift catch-up against current `canonicalize-rule` (no source re-fetch). Added `rule_key: soldier_points` to frontmatter (now required by SPEC-TEMPLATE). Added engine-input mappings to `discharge_year` and `service_length_band` follow-ups per §6.5 INTAKE + ENGINE SYNC. No content change to law, formula, values, or worked examples. — Claude
- **2026-06-13b** — Gap-closure pass against kolzchut (second read). Added: (1) second statute (Law for Absorption of Discharged Soldiers §1), (2) explicit "employed/self-employed paying tax" eligibility gate, (3) disability alongside medical in sub-12m carve-out, (4) reserve service (מילואים) edge case, (5) yeshiva/hesder edge case, (6) stacking note, (7) monetary point values per year (with 2026 ingested as known-but-not-yet-a-rule). Skipped: claiming process (Form 101 / 116 / דו"ח שנתי) — deferred to product surface, not this spec. Bottom-line values + formula unchanged → no code change, no test change. — Claude
- **2026-06-13** — Folded from `Intake/branches/soldier.md` + `Calculator/rules/types.ts` `SoldierPointsRule` docstring + `calculate.ts` `soldierPoints` comment. Added national-service track (24m threshold, both genders) and medical-early-discharge carve-out (sub-12m medical → treated as 12m). Verified against kolzchut. Prototype tax-rule spec. — Claude
- **2026-06-03** — §39A originally implemented with IDF-only thresholds (23m M / 22m F) per ITA Madrich 2024 lines 4298–4325. Worked examples from B1 PDF + kolzchut.
