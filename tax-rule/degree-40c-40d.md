---
section: 40C / 40D
slug: degree-40c-40d
status: active
rule_key: degree_points
last_verified: 2026-06-13
verified_against: [kolzchut-ba, kolzchut-ma, kolzchut-professional]
---

# §40C / §40D — Academic-Degree & Professional-Studies Credit Points (נקודות זיכוי בגין תואר אקדמי / לימודי מקצוע / תעודת הוראה)

## TL;DR
Annual credit points (נקודות זיכוי) for completing a recognized **academic degree** (§40C — תואר ראשון / תואר שני / תואר שלישי במסלול ישיר) or **professional studies** (§40D — לימודי מקצוע including תעודת הוראה, technician, electrician, paramedic, etc.). Starts the tax year **after** completion; deferrable for medicine/law/dentistry/pharmacy until after internship (התמחות). The 2023+ reform (per Economic Efficiency Law amendments) turned the credit from a 1-year benefit into a multi-year benefit equal to years of study, capped at 3 (BA / professional) or 2 (MA / PhD-direct). At 2026 point values (₪2,904/year), max BA benefit ≈ **₪8,712**; max MA benefit ≈ **₪2,904**.

## The law
- **Statutes:**
  - Income Tax Ordinance §40C (`פקודת מס הכנסה — סעיף 40ג`) — academic-degree credit (BA, MA, direct-track PhD).
  - Income Tax Ordinance §40D (`פקודת מס הכנסה — סעיף 40ד`) — professional-studies credit (לימודי מקצוע, includes תעודת הוראה).
  - Student Rights Law §§26–27 (`חוק זכויות הסטודנט — סעיפים 26-27`) — degree-credit framework.
  - Economic Efficiency Law 2015 §25 + 2018 §6 — reformed duration/structure (took effect for completions 2023+).
- **Hebrew name:** נקודות זיכוי ממס הכנסה בגין תואר אקדמי / לימודי מקצוע.
- **Plain English:** Anyone who completed a recognized degree (BA/MA/direct-PhD) or a recognized professional certification (≥1,700 academic hours), and is an Israeli resident paying income tax on any taxable income, gets a fractional or whole credit point per year for a window starting the year after completion.

## Sources
| Source | Where | Last fetched | Role |
|---|---|---|---|
| Kolzchut — BA (§40C) | https://www.kolzchut.org.il/he/נקודות_זיכוי_מס_הכנסה_בגין_תואר_ראשון | 2026-06-13 | Primary cross-check (BA) |
| Kolzchut — MA (§40C) | https://www.kolzchut.org.il/he/נקודות_זיכוי_מס_הכנסה_בגין_תואר_שני | 2026-06-13 | Primary cross-check (MA) |
| Kolzchut — Professional (§40D) | https://www.kolzchut.org.il/he/נקודות_זיכוי_מס_הכנסה_בגין_לימודי_מקצוע | 2026-06-13 | Primary cross-check (לימודי מקצוע / תעודת הוראה) |
| ITA Form 119 service page | https://www.gov.il/he/service/itc119 | 2026-06-13 (403 — refetch via authenticated client) | Form mechanics |
| ITA Madrich 2024 | `Calculator/rules/sources/2024/` | (archived) | Statutory interpretation |
| ITA Madrich 2025 | `Calculator/rules/sources/2025/` | (archived) | Statutory interpretation |

## Eligibility

**Gate (all required):**
1. Israeli resident (תושב ישראל).
2. Completed one of: BA (תואר ראשון), MA (תואר שני), direct-track PhD (תואר שלישי במסלול ישיר), OR professional studies meeting the §40D bar (≥1,700 hours + government-recognized certificate).
3. From a **recognized Israeli institution of higher education** (מוסד להשכלה גבוהה מוכר בישראל) or a government-recognized professional program.
4. Has taxable income to apply the credit against (employment, self-employment, OR any other taxable income — credit is not limited to work income).

**Credit quantum & duration by track:**

| Track | Completed 2014–2022 | Completed 2023+ |
|---|---|---|
| BA / תואר ראשון (§40C) | 1 pt × **1 year** (choose completion_year+1 OR completion_year+2) | 1 pt × **N years**, where N = study years, **cap 3** |
| MA / תואר שני (§40C) | 0.5 pt × **1 year** (choose completion_year+1 OR completion_year+2) | 0.5 pt × **N years**, where N = study years, **cap 2** |
| Direct-track PhD / תואר שלישי במסלול ישיר (§40C) | (treated as MA for credit purposes) | 0.5 pt × **2 years** post-completion |
| Professional / לימודי מקצוע / תעודת הוראה (§40D) | 1 pt × **1 year** (choose +1 OR +2) | 1 pt × **N years**, where N = study years, **cap 3** |

**Pre-2014 graduations:** No statutory entitlement under current framework.

**Recognized institutions:** Universities, accredited Israeli academic colleges (מכללה אקדמית מוכרת). Foreign degrees are generally NOT eligible (statute requires Israeli recognition).

**Professional-studies §40D bar:**
- ≥1,700 academic hours of study.
- Government-recognized professional certificate (`תעודת מקצוע המוכרת על ידי מוסד ממשלתי`).
- Examples: טכנאי, הנדסאי, שרטט, לבורנט, חשמלאי, פרמדיק, **תעודת הוראה**.

## Edge cases
- **Tax-year start** — credit ALWAYS starts the year **after** the calendar year in which studies concluded (שנת המס שאחרי השנה בה הסתיימו לימודי התואר).
- **Internship deferral (התמחות)** — for medicine, dentistry, pharmacy, law: claimant may **elect** to start the credit window the year after internship completion instead of the year after degree completion. Condition: internship must begin in the same tax year as degree completion OR the year immediately following. Requires `אישור על תקופת ההתמחות`. Rationale: intern stipends are typically low/untaxed, so deferring to higher-earning post-internship years maximizes utilization.
- **Mutual exclusion §40C ↔ §40D** — a user who holds BOTH an academic degree (BA/MA) AND a professional certificate must **choose one credit, not both**. Per kolzchut professional-studies page: "מי שזכאי לקבל נקודות זיכוי בגין תואר אקדמי וגם בגין לימודי מקצוע — יוכל לבחור באחד מהם". **BA + MA stack normally** (both fall under §40C and may be claimed in the same tax year).
- **One-time-only (§40D)** — professional-studies credit is granted **once in a lifetime**. Completing additional professional certifications does NOT renew eligibility.
- **One-of-a-kind (§40C)** — only one BA and one MA per lifetime qualifies; a second BA does not give a second credit at the same level.
- **Dropout / no degree** — ineligible; no partial credit. Diploma (תעודת סיום / אישור זכאות לתואר) is mandatory proof.
- **All taxable income** — credit applies against ALL taxable income, not just employment income (so capital gains, interest, business income all count toward the tax-owed pool that the credit reduces).
- **Stacking with other credits** — degree points stack with all other credit points the user is entitled to (2.25/2.75 base resident, §39A soldier, §35 immigrant, etc.). They share the single tax-liability cap.
- **Cannot generate refund beyond tax owed** — pure credit, not a payment. נקודות זיכוי מקטינות את גובה מס ההכנסה ולא יותר מאשר עד מצב של מס אפס.
- **Retroactive claims** — up to **6 tax years** back (standard ITA refund window).
- **Pre-2014 completions** — no credit.
- **Reform date is COMPLETION year, not enactment year** — the law was enacted earlier (Economic Efficiency Law 2018 §6), but its multi-year benefit applies only to completions from 2023 onward.

## Formula

```
# Per-degree contribution
def points_for(degree):
  if degree.completion_year < 2014: return 0
  if degree.completion_year < 2023:
    # Pre-reform: 1 year of credit, claimant chooses +1 or +2 from completion year
    annual_pts = {'first': 1, 'second': 0.5, 'third_or_medical': 0.5, 'professional': 1}[degree.kind]
    eligible_window = {completion_year + 1, completion_year + 2}   # claimant picks ONE
    if internship_deferral: eligible_window = {internship_end + 1}
    return annual_pts if tax_year in eligible_window else 0
  else:  # 2023+ — multi-year by study years
    cap = {'first': 3, 'second': 2, 'third_or_medical': 2, 'professional': 3}[degree.kind]
    annual_pts = {'first': 1, 'second': 0.5, 'third_or_medical': 0.5, 'professional': 1}[degree.kind]
    N = min(degree.study_years, cap)
    window_start = (internship_end + 1) if internship_deferral else (completion_year + 1)
    eligible_window = range(window_start, window_start + N)        # N consecutive years
    return annual_pts if tax_year in eligible_window else 0

# Aggregation per tax year
total = points_for(BA) + points_for(MA) + points_for(direct_phd)   # §40C — these stack
if has_professional_only:                                          # §40D
  total += points_for(professional)
# Mutual exclusion: if user has BOTH §40C AND §40D credits available in same tax year,
# pick the larger of (§40C contributions) vs (§40D contribution). Cannot claim both.
```

## Required documents
| Doc | Form # | Playbook |
|---|---|---|
| Diploma / degree-eligibility certificate (תעודת סיום / אישור זכאות לתואר) | (issued by institution) | *not built yet* |
| Annual credit-claim form | טופס 119 | *not built yet* — `Collector/documents/form-119-degree.md` is unwritten |
| Employee declaration (when claiming via employer) | טופס 101 | *not built yet* |
| Professional-cert proof (for §40D claims) | (issued by recognizing body) | *not built yet* |
| Internship-completion certificate (for medicine/law/dentistry/pharmacy deferral) | אישור על סיום ההתמחות | *not built yet* |

**Manual fallback until playbook exists:** download Form 119 from gov.il (search 'טופס 119'), fill diploma + completion date, drop in `~/Downloads/RobinTax/`. Form URL: https://www.gov.il/he/service/itc119

## Worked examples
Each row MUST have a 1:1 test in `Calculator/engine/calculate.test.ts` whose name contains the `[id]` tag. Drift test enforces this.

> **NOTE — table scope:** these examples cover CURRENT shipped engine behavior, which implements the **pre-2023 single-year, flat-`first_degree`** simplification. Target behavior (post-2023 reform: per-kind, multi-year) is documented in `## Target worked examples (post-engine-reform)` below and is **not** drift-checked because the engine cannot yet compute it. See Conflict #1.

| id | Scenario | Expected |
|---|---|---|
| `degree-none` | `taxpayer.degree = undefined` → no degree credit added | 0 pts |
| `degree-present-current-flat-first-degree` | `taxpayer.degree = { kind: 'second', completed_year: 2024 }` → engine ignores kind & year, awards flat `rules.degree_points.value.first_degree` | `rules.degree_points.value.first_degree` |

## Target worked examples (post-engine-reform — NOT drift-checked)
These describe correct §40C/§40D behavior per the law. The engine cannot yet compute them. They become the worked-examples table once the engine + types are extended (see Conflict #1).

| Scenario | Expected |
|---|---|
| BA grad 2024, 3-year program, claim 2025 | 1 pt |
| BA grad 2024, 3-year program, claim 2026 | 1 pt |
| BA grad 2024, 3-year program, claim 2027 | 1 pt |
| BA grad 2024, 3-year program, claim 2028 | 0 pts (window closed) |
| BA grad 2022 (pre-reform), claim 2023 | 1 pt |
| BA grad 2022 (pre-reform), claim 2024 | 1 pt (claimant's choice) |
| BA grad 2022 (pre-reform), claim 2025 | 0 pts |
| BA grad 2013 (pre-2014) | 0 pts in any tax year |
| MA grad 2024, claim 2025 | 0.5 pt |
| MA grad 2024, claim 2026 | 0.5 pt |
| MA grad 2024, claim 2027 | 0 pts (cap 2) |
| Direct-PhD grad 2024, claim 2025 | 0.5 pt |
| Direct-PhD grad 2024, claim 2026 | 0.5 pt |
| Teaching cert (§40D) grad 2024, 4-year program, claim 2027 | 1 pt (year 3 = cap) |
| Teaching cert (§40D) grad 2024, 4-year program, claim 2028 | 0 pts |
| User holds BA + teaching cert, both active years | max(BA, teaching) — mutual exclusion |
| User holds BA + MA, both active years | BA + MA stack |
| Med-school grad 2024, internship until 2026, deferred claim 2027 | 1 pt |

## Intake
Read by the `intake` skill walker when the user checks `degree` in [`Intake/checklist.md`](../Intake/checklist.md). The gate is the checklist check itself — the follow-ups below are the queue the walker fires under the `Degree {i}/{N}` prefix.

### Gate context (shown above the follow-ups, not a separate question)
- **Checklist label (Hebrew):** סיימתי תואר (ראשון, שני, שלישי, תעודת מקצוע ותעודת הוראה)
- **`rule_lede` (plain Hebrew, no year-specific amounts — shown as the first follow-up's description):**
  > מי שסיים תואר אקדמי או תעודה מקצועית במוסד מוכר בישראל מקבל נקודות זיכוי ממס בשנים שאחרי סיום הלימודים. לימודים בחו״ל אינם נחשבים. דוגמה: תואר ראשון, תואר שני, תעודת הוראה, הנדסאי.
- **On `unknown` paths in follow-ups:** Form 119 requires actual diploma details, so unknown answers should narrow via doc rather than pessimistic-seed unrelated docs.

### Follow-ups
- **`degrees_held`** — "Which degree(s) did you complete? Pick all that apply." `multiSelect` `AskUserQuestion`. Options: `תואר ראשון (BA/BSc)`, `תואר שני (MA/MSc)`, `תואר שלישי / רפואה / רפואת שיניים / רוקחות`, `תעודת הוראה / הנדסאי / טכנאי (professional)`. Reason: §40C vs §40D dispatch + point quantum per kind.
- **`degree_completion_years`** — `AskUserQuestion`, single-select, with two explicit one-click escapes and an auto-`Other` for the free-text path. Question text: `For each degree you completed, what year did you finish it? (e.g. BA 2018, MA 2021). Year-only is enough — pick "Other" to type it in.`. Options (in this exact order, exact wording — the parenthetical clauses are load-bearing, they explain WHY the shortcut exists):
   1. `All before 2014 (no degree credit on those — law took effect 2014)` — picking this records the branch as `n/a`, no doc seeded.
   2. `I don't remember the year(s) — we'll check via the diploma` — picking this records the branch as `unknown`, seeds the doc, and Calculator resolves the years from the diploma at calc-time.
   - **Auto-`Other`** captures the actual years as free-text in the format `BA 2018, MA 2021`. The harness adds it; do not author it as an explicit option.

   Reason: pre-2023 vs post-2023 reform fork + filing-year window check + pre-2014 cutoff. Pure free-text would force the >90% of users who graduated in obvious post-2014 years to type a string when one click could express the same intent for the two edge cases. The "2014" parenthetical in option 1 is non-negotiable — a bare `All before 2014` looks like an arbitrary number; the parenthetical tells the user why that year matters and prevents the "why 2014?" question.

- **`internship_deferral`** — **conditional**: fire ONLY if `degrees_held` includes `תואר שלישי / רפואה / רפואת שיניים / רוקחות` (the deferral-eligible medical cluster). `AskUserQuestion`, single-select. Question text: `ברפואה / רפואת שיניים / רוקחות עשית התמחות אחרי התואר? נקודות הזיכוי יכולות להידחות לשנה שאחרי סוף ההתמחות. אם עשית — באיזו שנה היא הסתיימה? (אפשר "Other" לכתוב שנה)`. Options (exact order):
   1. `לא עשיתי התמחות` — no deferral; the window stays at completion+1/+2 (records `internship_deferral = none`).
   2. `לא זוכר/ת מתי הסתיימה` — `unknown`; seed the doc and let the Calculator resolve from the internship certificate (`אישור על תקופת ההתמחות`).
   - **Auto-`Other`** captures the internship-end year as free-text (e.g. `2019`).

   Reason: §40C lets **medicine / dentistry / pharmacy / law** electively defer the credit window to **internship_end + 1** (intern stipends are low/untaxed, so deferral maximizes utilization — see `## Edge cases → Internship deferral`). This is the **only** path by which a "too-early" *completion* year can still land a credit inside the 2020–2025 filing window (e.g. degree 2015, internship ended 2019 → credit year 2020). Without this branch the year-based scoping would wrongly mark such users `n/a`. **Engine caveat:** the calc cannot yet *compute* the deferred credit (Conflict #6) — capturing this input lets the **seed** pull the diploma + internship cert for the right years and flag the user; the point math stays a TODO until §40C engine work lands.

> **Study years are NOT asked at intake** — the diploma carries the program duration, and the Calculator reads it off the cert (or asks the user at calc-time if it can't). Avoids a brittle free-text question that the engine cannot yet consume (see Conflict #1).

### Seeds
- **Doc (when gate = Yes):** `form-119-degree` (טופס 119 — בקשה להקלה במס ליחיד הזכאי לתואר אקדמי/תעודת מקצוע).
- **Filing-year scoping** (intake doesn't know `study_years` — use the per-kind cap as a pessimistic upper bound for the window):
  - **Pre-2014 graduates:** branch is `n/a`, do not seed.
  - **Pre-2023 graduates (2014–2022):** credit applies to one of {completion+1, completion+2}. If neither year ∈ filing window → `n/a`, don't seed.
  - **Post-2023 BA graduates:** pessimistic window = completion+1 through completion+3. Seed if any year ∈ filing window.
  - **Post-2023 MA graduates:** pessimistic window = completion+1 through completion+2. Seed if any year ∈ filing window.
  - **Post-2023 PhD-direct:** seed if completion+1 or +2 ∈ filing window.
  - **Professional / teaching:** pessimistic window = completion+1 through completion+3. Seed if any year ∈ filing window.
  - **Internship-deferral tracks (medicine / dentistry / pharmacy / law, per `internship_deferral`):** when the user did an internship, the window **starts at `internship_end + 1`** instead of `completion + 1` (pre-reform: just `{internship_end + 1}`; post-2023: `internship_end+1 .. +N`). Seed if that shifted window ∈ filing years. **This overrides the completion-year `n/a` check** — a degree whose *completion* window misses the filing years can still seed via the deferred window (e.g. completion 2015 → would be `n/a`, but internship ended 2019 → window {2020} → seed). If `internship_deferral = unknown` (didn't recall the year) → seed pessimistically and let the diploma + internship cert resolve at calc-time.
  - Calculator narrows the window using actual `study_years` (and `internship_end`, once the engine supports it) from the diploma/cert.
- **Mutual exclusion gate (§40C ↔ §40D)**: if user reports BOTH academic degree(s) AND professional cert, surface a wrap-up note: "You qualify for either §40C (degrees) OR §40D (professional cert) — not both. The calculator picks the larger; you can override."

### Profile key
`degree`

## Implementation map
| Slice | File |
|---|---|
| Schema | [`Calculator/rules/types.ts`](../Calculator/rules/types.ts) — `DegreePointsRule` |
| Year values | [`Calculator/rules/2024.ts`](../Calculator/rules/2024.ts), [`Calculator/rules/2025.ts`](../Calculator/rules/2025.ts) — `degree_points` |
| Math | [`Calculator/engine/calculate.ts`](../Calculator/engine/calculate.ts) — `calculate()` (inline; no dedicated helper yet) |
| Tests | [`Calculator/engine/calculate.test.ts`](../Calculator/engine/calculate.test.ts) — `describe('calculate — degree points ...')` |
| Doc playbook | `Collector/documents/form-119-degree.md` (not built yet) |
| Checklist entry | [`Intake/checklist.md`](../Intake/checklist.md) → `degree` |
| Profile key | `<memory>/profile.md` → `degree` |
| Drift check | [`tax-rule/drift.test.ts`](drift.test.ts) |

## Monetary point values per year
The nominal value of 1 credit point lives in `point_value_annual` / `point_value_monthly` on each year-rule file — NOT in `degree_points`. §40C/§40D only own the *count* of points; the multiplier is shared with every other points-based credit.

| Year | 1 pt / year | 0.5 pt / year | Source |
|---|---|---|---|
| 2024 | per `2024.ts point_value_annual` | ×0.5 | `Calculator/rules/2024.ts` |
| 2025 | per `2025.ts point_value_annual` | ×0.5 | `Calculator/rules/2025.ts` |
| 2026 (not yet a filing year) | ₪2,904 | ₪1,452 | kolzchut 2026 — not yet ingested |

## Year values (canonical — TS rule tables MUST mirror this JSON)
```json
{
  "2024": {
    "first_degree": 1,
    "second_degree": 0.5,
    "third_or_medical": 1,
    "eligible_years_post_completion": 1
  },
  "2025": {
    "first_degree": 1,
    "second_degree": 0.5,
    "third_or_medical": 1,
    "eligible_years_post_completion": 1
  }
}
```

> **NOTE:** these year values reflect CURRENT shipped state, which encodes the **pre-2023 single-year rule** for ALL graduations. This is wrong for post-2023 grads. Surfaced as Conflict #1 below; the values are not patched silently per the skill's "values are sacred" rule.

## Year-over-year changes
| Year | Change |
|---|---|
| 2024 → 2025 | No change to the `DegreePointsRule` shape or values. Indexation applies to `point_value_annual`, not to §40C/§40D points. |

## Open questions
- **Form 119 playbook not built** — `Collector/documents/form-119-degree.md` is unwritten. Manual fallback documented in intake seeds.
- **2026 year values not yet captured** — ship `"2026":` block when filing 2026 begins.
- **ITA Form 119 service page returned 403** — needs an authenticated fetch (gov.il blocks unauthenticated WebFetch). Re-verify on next pass.
- **Law (LLB) internship deferral not captured** — `degrees_held` has no law option (law is a `תואר ראשון`/BA), so the `internship_deferral` follow-up — conditioned on the `תואר שלישי / רפואה / רפואת שיניים / רוקחות` cluster — won't fire for law grads doing a clerkship (התמחות בעריכת דין), even though §40C grants them the same deferral. Sub-gap; fix by either adding a law track to `degrees_held` or broadening the `internship_deferral` trigger to also fire on a first degree with a "was it law?" check.

## Verification log
- **2026-06-13** — Initial canonicalization. Folded from `Intake/branches/degree.md`, `Calculator/rules/types.ts` `DegreePointsRule` shape, `Calculator/rules/2024.ts:102-113` + `2025.ts:97-103` (both with BUG comments already flagged 2026-06-10), and `Calculator/engine/calculate.ts:458` (`// simplified` comment). Gap-passed against three kolzchut pages (BA, MA, professional). Form 119 gov.il page returned 403 — re-fetch needed via authenticated client. **6 conflicts surfaced** below (see report); none silently patched. — Claude

## Conflicts surfaced (not silently fixed)

See the run report's "🚨 CONFLICTS FOUND" section. In brief:
1. `degree_points.value.eligible_years_post_completion: 1` is the **pre-2023 rule** applied to all graduations — wrong for 2023+ completions.
2. Engine `calculate.ts:458` hardcodes `first_degree` regardless of degree kind, completion year, or study years — `// simplified`.
3. `DegreePointsRule` type can't encode per-kind year caps or completion-year logic.
4. `Calculator/engine/calculate.ts:36` `taxpayer.degree.kind` has no `'professional'` variant — §40D unrepresentable.
5. Engine has no mutual-exclusion logic for §40C ↔ §40D.
6. No internship-deferral **engine** logic. **Partly addressed 2026-06-29:** intake now *captures* the input (the `internship_deferral` follow-up) and the Seeds scoping shifts the window to `internship_end+1` so the diploma/cert gets pulled for the right filing years + the user is flagged. The **engine** still cannot compute the deferred points — that remains the open part of this conflict.
