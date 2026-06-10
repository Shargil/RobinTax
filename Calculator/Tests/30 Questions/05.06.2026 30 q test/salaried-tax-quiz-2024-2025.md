# Israeli salaried-tax verification quiz — 2024 + 2025

A 30-question quiz covering the rules a salaried employee (שכיר) needs for a personal tax return for tax years 2024 and 2025. Use it to spot-check the populated rule tables (`Calculator/rules/2024.ts`, `2025.ts`) or to cross-check against another source.

All answers should be derivable from the archived ITA sources under [`sources/2024/`](../../../rules/sources/2024/) and [`sources/2025/`](../../../rules/sources/2025/) — primarily `guide-individuals-{year}.pdf` (annual filing guide) and `annual-deductions-{year}.pdf` (rates booklet).

## Brackets & rates (מדרגות מס)

1. List the income-tax brackets (מדרגות מס) on earned income (יגיעה אישית) for tax year **2025**. For each bracket, give the upper threshold in NIS and the marginal rate.

2. What is the income range (NIS) covered by the **35%** bracket in tax year **2024**?

3. Above what annual income in NIS does the **47%** marginal rate start in tax year **2025**?

4. The Israeli tax brackets in NIS are identical for tax years 2024 and 2025. What law caused that, and what does it apply to?

5. A salaried employee has annual taxable income of 105,000 NIS in 2025. What marginal rate applies to the slice between 100,000 and 105,000 NIS?

## Credit points (נקודות זיכוי)

6. What is the **annual** value of one credit point (נקודת זיכוי, §33A) in tax year **2024**?

7. What is the **monthly** value of one credit point in tax year **2025**?

8. Did the value of a credit point change between 2024 and 2025? If so, by how much?

9. How many base credit points does an **Israeli-resident male** receive in tax year **2024** (before any status-based add-ons)?

10. How many base credit points does an **Israeli-resident female** receive in tax year **2025**?

## Discharged soldier (חייל משוחרר — §39A)

11. Under §39A, how many credit points per month of **full** regular military service (שירות סדיר) does a discharged soldier get in the years they're eligible?

12. Starting from when, and for how many tax years, can a discharged soldier claim the §39A credit?

13. A soldier finished regular service in **July 2022**. What is the **last** tax year in which they can still claim the §39A soldier credit?

14. A male soldier completed 24 months of full regular service and was discharged in December 2024. In tax year **2025**, how many §39A credit points is he entitled to (assuming no other cap)?

## §11 settlement benefit (יישוב מוטב)

15. What is the **§11 discount rate** for residents of **מדרשת בן גוריון** in tax year **2024**?

16. What is the **income ceiling** (תקרה) on which the §11 discount applies for residents of **מדרשת בן גוריון** in tax year **2025**?

17. What is the §11 discount rate for residents of **לקיה** in tax year **2025**?

18. Under §11 of the Eilat Free Trade Zone Law, what discount rate applies to **earned income produced in Eilat**, and up to what NIS ceiling, in tax year **2025**?

19. A salaried employee qualifies for the §11 settlement benefit but only had their center-of-life (מרכז חיים) in the eligible settlement for **6 of 12 months** in tax year 2024. How is the discount pro-rated, if at all?

20. Did the §11 discount rate or ceiling for **מדרשת בן גוריון** change between tax year 2024 and 2025?

## Donation credit (§46 — תרומה למוסד ציבורי)

21. What is the §46 donation credit **rate** (אחוז הזיכוי) for individuals in tax year **2024**?

22. What is the **minimum** annual donation (סכום מינימלי) eligible for the §46 credit in tax year **2025**?

23. What is the **absolute maximum** eligible annual donation amount in NIS under §46 in tax year **2025**, and what additional share-of-income cap also applies?

## Pension & life insurance (§47, §45A)

24. What is the **§47(a)(1)(1)** income-deduction ceiling for work income (תקרת הכנסה מזכה — רק מהכנסת עבודה) in tax year **2024**?

25. What is the **§45A(d)** credit-base ceiling (תקרת הסכום לזיכוי בעד דמי ביטוח ותגמולים) in tax year **2025**?

26. What is the credit **rate** (אחוז הזיכוי) under §45A for qualifying pension/life-insurance contributions?

## Surtax (מס יסף — §121B)

27. At what annual taxable-income threshold (NIS) does the **3% מס יסף** surtax start in tax year **2024**, and what is its rate?

28. Did the **מס יסף** threshold and rate change between 2024 and 2025? Why or why not?

## Mandatory filing (חובת הגשת דוח שנתי)

29. Above what annual taxable income (NIS) is a salaried individual **required** to file an annual return in tax year **2024**, regardless of refund/owe status?

30. A salaried employee had income from **two employers in 2024** without obtaining תיאום מס (tax coordination). Under what conditions does this trigger a mandatory filing requirement?

---

## How to use this for verification

- For each question, look up the answer in the archived sources (see [`sources/2024/sources.md`](../../../rules/sources/2024/sources.md), [`sources/2025/sources.md`](../../../rules/sources/2025/sources.md)). For most, `guide-individuals-{year}.pdf` is the canonical reference.
- Compare your answers to the values populated in [`2024.ts`](../../../rules/2024.ts), [`2025.ts`](../../../rules/2025.ts), [`settlements/2024.ts`](../../../rules/settlements/2024.ts), [`settlements/2025.ts`](../../../rules/settlements/2025.ts).
- Any mismatch is a sign-off blocker — flag it and we re-investigate before flipping `verification.sign_off` to `'verified'`.
- Note: questions 4, 8, 20, 28 specifically test the **indexation freeze 2025–2027** (Arrangements Law, gov.il `sa161224-4`) — many indexed NIS amounts are unchanged across the two years.
