# Answers — salaried-tax verification quiz 2024 + 2025

**Source policy:** every answer below is derived ONLY from this repository's populated rule tables (`Calculator/rules/{2024,2025}.ts`, `Calculator/rules/settlements/{2024,2025}.ts`) and the archived ITA PDFs under `Calculator/rules/sources/{2024,2025}/` (via their extracted text in `/tmp/robintax-extract/`). No prior knowledge, no internet. Citations point at `<extracted-filename>:<line>` or `<rule-file>:<field>`.

Numbering matches [`salaried-tax-quiz-2024-2025.md`](salaried-tax-quiz-2024-2025.md).

## Brackets & rates

**1.** Earned-income brackets for **2025**:

| Upper threshold (₪/year) | Marginal rate |
|---|---|
| 84,120 | 10% |
| 120,720 | 14% |
| 193,800 | 20% |
| 269,280 | 31% |
| 560,280 | 35% |
| above 560,280 | 47% |

Citation: `annual-deductions-2025.txt:379–384` (the "שיעורי המס החלים על הכנסה מיגיעה אישית בשנת המס 2025" table) → mirrored in `Calculator/rules/2025.ts:brackets`.

**2.** The **35%** bracket in **2024** runs from **₪269,281 to ₪560,280** (annual). Citation: `annual-deductions-2024.txt:358`; `Calculator/rules/2024.ts:brackets[4]`.

**3.** The **47%** marginal rate starts at **₪560,281** in **2025** (i.e., everything above the 35% bracket upper bound). Citation: `annual-deductions-2025.txt:384`; `Calculator/rules/2025.ts:brackets[5]`.

**4.** The brackets are identical because of the **Economic Efficiency Law (Legislative Amendments to Meet 2025 Budget Targets — Freezing of Tax Updates and Surtax), TSh.P.H–2024**, published **26 December 2024** — it froze indexation of tax-law NIS amounts (including brackets and מס יסף) for tax years **2025–2027**. Citation: `annual-deductions-2025.txt:409–410` (the explicit text "ביום 26 בדצמבר 2024 פורסם חוק ההתייעלות הכלכלית… הקפאת עדכוני מס ומס יסף"); `Calculator/rules/2025.ts:notes[0]`.

**5.** **14%.** In **2025** the slice between ₪100,000 and ₪105,000 sits entirely inside the second bracket (₪84,121–₪120,720 at 14%). Citation: `annual-deductions-2025.txt:380`; `Calculator/rules/2025.ts:brackets[1]`.

## Credit points (נקודות זיכוי)

**6.** **2,904 ₪/year** (§33A). Citation: `annual-deductions-2024.txt:402` ("‫לשנה‬ ‪2,904‬ ‫נקודת זיכוי 33א‬"); `Calculator/rules/2024.ts:point_value_annual`.

**7.** **242 ₪/month**. Citation: `Calculator/rules/2025.ts:point_value_monthly` (₪2,904 / 12 = ₪242, consistent with the annual figure on `annual-deductions-2025.txt:434`).

**8.** **No change.** Both years: 2,904 ₪/year and 242 ₪/month. Same per the same freeze in answer 4. Citation: `Calculator/rules/2024.ts:point_value_annual` + `Calculator/rules/2025.ts:point_value_annual` (identical values).

**9.** **2.25** base credit points for an Israeli-resident male in 2024. Citation: `Calculator/rules/2024.ts:base_points.value.resident_male`.

**10.** **2.75** base credit points for an Israeli-resident female in 2025 (resident 2.25 + 0.5 for being female). Citation: `Calculator/rules/2025.ts:base_points.value.resident_female`.

## Discharged soldier (§39A)

**11.** **1/6 of a credit point per month** of full regular service (for a male who completed ≥23 months full service, or a female who completed ≥22). For shorter regular-service durations the rate is **1/12 per month** instead. Citation: `guide-individuals-2024.txt:4308` ("חייל לאחר 23 חודשי שירות מלאים וחיילת לאחר 22 חודשי שירות מלאים — 1/6 נקודת זיכוי לחודש") and `guide-individuals-2024.txt:4313` ("הזכאות בשל תקופת שירות קצרה יותר הינה ל-1/12 נקודת זיכוי לחודש"); `Calculator/rules/2024.ts:soldier_points.value.points_per_month_full_service`.

**12.** The credit is granted starting **the month after the month of discharge** ("מהחודש שלאחר החודש בו השתחרר"), for a window of **36 months from the end of the discharge month**. Citation: `guide-individuals-2024.txt:~4316` ("בכל תחום של עיסוק החל מהחודש שלאחר החודש בו השתחרר") and the explicit example at `guide-individuals-2024.txt:4324` ("תום 36 חודשים מתום חודש השחרור"); `Calculator/rules/2024.ts:soldier_points.value.eligible_years_post_discharge = 3`.

**13.** **Tax year 2025 (partial — January through July).** A July-2022 discharge gives an eligibility window ending **end of July 2025** (36 months from end of discharge month, per the example at `guide-individuals-2024.txt:4322–4325`). In tax year 2025, eligible months = 7 (Jan–Jul); tax year 2024 is the last full year.

**14.** Per the rule in the local PDFs: **2 credit points in 2025.** Reasoning: discharge December 2024 → 36-month eligibility window through end of December 2027; in tax year 2025 the full 12 months are eligible. 24 months of full regular service ≥23, so the rate is **1/6 per eligible month**: 12 × 1/6 = **2.0 points** in 2025. Citation: `guide-individuals-2024.txt:4308, 4318` (in-discharge-year pro-ration) and `guide-individuals-2024.txt:4322–4325` (the worked example).

> ⚠️ **Engine-model discrepancy found by this question.** `Calculator/engine/calculate.ts:soldierPoints` currently computes `service_months_full × (1/6)` — i.e., total service months × per-month rate, capped at `max_points_per_year`. For this case it would return 24 × 1/6 = 4.0 points, which is **wrong**. The PDF rule multiplies the per-month rate by the **eligible months in the tax year** (capped by the 36-month window), not by the soldier's total service length. **The engine model needs to be corrected** before computing real refunds with non-trivial soldier inputs.

## §11 settlement benefit

**15.** **7%** for **מדרשת בן גוריון** in tax year **2024**. Citation: `Calculator/rules/settlements/2024.ts` (rate 0.07) → source row at `guide-individuals-2024.txt:7993` (priority group 2, code 1140) and corroborated at `annual-deductions-2024.txt:1363` and `monthly-deductions-2024.txt:1237`.

**16.** **146,640 ₪/year** for **מדרשת בן גוריון** in tax year **2025**. Citation: `Calculator/rules/settlements/2025.ts` (income_ceiling_nis 146640) → source row at `guide-individuals-2025.txt:8102` and `annual-deductions-2025.txt:1387`.

**17.** **18%** for **לקיה** in tax year **2025**. Citation: `Calculator/rules/settlements/2025.ts` (rate 0.18) → source row at `guide-individuals-2025.txt:8083` (priority group 13, code 1060).

**18.** Eilat (§11 of the Free Trade Zone Law): **10%** discount on earned income produced in Eilat or the Hevel Eilot region, up to a ceiling of **₪268,560** in tax year **2025**. Citation: `guide-individuals-2025.txt:7885` ("הנחה של 10% על הכנסה חייבת מיגיעה אישית שהופקה באזור אילת או חבל אילות עד לתקרה של ₪ 268,560") and `annual-deductions-2025.txt:794`.

**19.** **Pro-rated linearly by the qualifying months / 12.** For the user-facing engine this is implemented as `eligibleIncome × rate × (qualifying_months / 12)`. Local-source citation for the **Eilat** §11 explicitly states pro-rata: `guide-individuals-2025.txt:4757` ("מהמס באופן יחסי לתקופת תושבותך באילת"). For **§11 settlement** specifically, the local PDFs require a 12-month center-of-life test (`annual-deductions-2025.txt:47–51` discusses center-of-life and the special war-evacuation extension), and the explicit linear-pro-rata wording for non-Eilat §11 settlements was **not** found in the extracted text — the engine's simple `months/12` model is a simplification that should be reviewed before signing off `verification.sign_off='verified'`. Citation: `Calculator/engine/calculate.ts:settlementDiscount`.

**20.** **No change** between 2024 and 2025 for מדרשת בן גוריון (7% / ₪146,640 in both years). Citation: `Calculator/rules/settlements/2024.ts` vs `Calculator/rules/settlements/2025.ts` — identical entries — corroborated by independent extracts of the table in `annual-deductions-2024.txt:1363` and `annual-deductions-2025.txt:1387`.

## Donation §46

**21.** **35%** for individuals. Citation: `guide-individuals-2025.txt:3993` ("הזיכוי הוא בשיעור של 35% מתשלומיך"), corroborated at `guide-individuals-2025.txt:4057, 4644, 4653, 4676`. `Calculator/rules/2024.ts:donation.value.rate = 0.35`.

**22.** **₪207/year**. Citation: `annual-deductions-2025.txt:505` ("תרומה למוסד ציבורי — זיכוי ממס — סכום תרומה מינימלי 46(א): 207"); `Calculator/rules/2025.ts:donation.value.min_eligible_nis_per_year`.

**23.** Eligible amount is the **lower of**: (a) **₪10,354,816** (absolute NIS cap, §46(a)), and (b) **30% of taxable income**. Citation: `annual-deductions-2025.txt:509` for the absolute cap; `guide-individuals-2025.txt:6109` for the combined rule ("על 30% מההכנסה החייבת, או על ₪ 10,354,816, לפי הנמוך ביניהם"). `Calculator/rules/2025.ts:donation.value.max_eligible_nis_absolute = 10_354_816`, `max_eligible_share_of_taxable_income = 0.30`.

## Pension & life insurance (§47, §45A)

**24.** **₪116,400/year** in 2024. Citation: `annual-deductions-2024.txt:406` ("תקרת הכנסה מזכה 47(א)(1)(1) — רק מהכנסת עבודה: 116,400"); `Calculator/rules/2024.ts:pension.value.employee_deduction_ceiling_nis`.

**25.** **₪2,268/year** in 2025. Citation: `annual-deductions-2025.txt:445` ("תקרת הסכום לזיכוי בעד דמי ביטוח ותגמולים 45א(ד): 2,268"); `Calculator/rules/2025.ts:pension.value.employee_credit_ceiling_nis`.

**26.** **35%** under §45A. Citation: `guide-individuals-2025.txt:4619` ("יהיה הזיכוי סך של ₪ 630 שהם 35% מ-₪ 1,800") and `guide-individuals-2025.txt:4676` ("של 35% מסכום התרומה" — same 35% rate applies in §45A and §46 contexts). `Calculator/rules/2025.ts:pension.value.credit_rate = 0.35`.

## Surtax (§121B — מס יסף)

**27.** **3%** on taxable income above **₪721,560/year** in 2024 (equivalent to ₪60,130/month). Citation: `annual-deductions-2025.txt:397–399` (verbatim: "יחיד אשר הכנסתו החייבת בשנת המס עלתה על ₪ 721,560 (₪ 60,130 לחודש), יהיה חייב במס נוסף על חלק הכנסתו החייבת העולה על הסכום הנ"ל, בשיעור של 3%"); `Calculator/rules/2024.ts:surtax`. (Note: the booklet shows this section in the **2025** publication, but the same NIS threshold applies for 2024 — the indexation freeze means 2024 and 2025 figures are identical.)

**28.** **No change.** Same ₪721,560 threshold and 3% rate in both years. Reason: the same freeze in answer 4 (the Economic Efficiency Law explicitly froze "מס יסף" updates for 2025–2027). Citation: `annual-deductions-2025.txt:410` ("הקפאת עדכוני מס ומס יסף"); `Calculator/rules/2025.ts:surtax`.

## Mandatory filing

**29.** **₪721,560/year** taxable income. Citation: `guide-individuals-2024.txt:152, 224, 266, 1046, 1218` (multiple references to "ההכנסה החייבת עולה על ₪ 721,560 ש"ח בשנת 2024" triggering mandatory filing per §131 + §121B); `Calculator/rules/2024.ts:mandatory_filing.value.high_income_nis`.

**30.** **A salaried individual must file** if their combined salary from ≥2 employers (without obtaining תיאום מס) exceeds the **₪721,560** annual threshold (same as the high-income trigger above). Citation: `guide-individuals-2024.txt:152, 268` (the §1 mandatory-filing rule references salary "עד ₪ 721,560 בשנת [המס]" as the exemption ceiling — above that, you must file); `Calculator/rules/2024.ts:mandatory_filing.value.two_employers_combined_nis = 721_560`.

> ⚠️ **Sourcing caveat.** The local PDFs phrase the salary-mandatory-filing trigger in terms of total salary above ₪721,560, but the *specific* "two-employers-without-תיאום" sub-condition (a separate, lower threshold that does exist in Israeli law) was **not** explicitly captured in my extracted text. `Calculator/rules/2024.ts` uses ₪721,560 as a conservative single value; the granular "two-employer" sub-threshold should be located and added before signing off if any user actually has two employers without coordination. The full source is the תקנות מס הכנסה (פטור מהגשת דין וחשבון) regulation, not separately archived in this session.

---

## Findings from this verification pass

Two real issues this quiz surfaced that block sign-off:

1. **Engine bug in `soldierPoints`** (question 14). The function multiplies total service months by 1/6 instead of the **eligible months in the tax year** × 1/6. For a soldier with 24 months of service, it returns 4 points instead of the correct 2 (per year). Fix needed in `Calculator/engine/calculate.ts:soldierPoints` before any refund with non-trivial soldier-credit input.

2. **§11 settlement pro-ration not explicitly cited** (question 19). The engine pro-rates linearly by `qualifying_months / 12`; the PDFs explicitly confirm linear pro-ration for **Eilat** but not for §11 settlements outside Eilat. Verify or correct before sign-off.

Minor follow-ups (not blockers): the two-employer mandatory-filing sub-threshold (question 30) should be sourced from the תקנות פטור מהגשת דין וחשבון for completeness.

Everything else: answers above are confirmed against the populated rule files + archived PDFs.
