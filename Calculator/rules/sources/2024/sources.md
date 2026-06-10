# 2024 — archived sources manifest

Per-year provenance for `Calculator/rules/2024.ts`. One entry per archived artifact.
Each row records: where it came from, when it was fetched, and a SHA256 over the file.
The `cite_key` matches an entry in `2024.ts`'s `citations` map (to be filled in when the
year is populated from these PDFs).

| cite_key | file | url | fetched | sha256 | covers |
|---|---|---|---|---|---|
| `madrich-2024` | `guide-individuals-2024.pdf` | https://www.gov.il/BlobFolder/generalpage/income-tax-guide-knowyourright/he/Guides_IncomeTax_da-2024.pdf | 2026-06-03 | `80dea857…93bc` | **Primary.** Annual filing guide "דע זכויותיך וחובותיך 2024" — brackets, point value, status credits, donations §46, pension, separate rates, mandatory-filing thresholds. Backs most parameters. |
| `annual-deductions-2024` | `annual-deductions-2024.pdf` | https://www.gov.il/BlobFolder/generalpage/income-tax-annual-deductions-booklet/he/generalInformation_income-tax-yearly-deductions-booklet_yearly-deductions-booklet-2024.pdf | 2026-06-03 | `bd92a175…b7a4` | **Two-source check for brackets + point value.** Annual deductions calculation booklet. |
| `monthly-deductions-2024` | `monthly-deductions-2024.pdf` | https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2024.pdf | 2026-06-03 | `b7359a86…7fe8` | Monthly deductions booklet (Jan 2024). Cross-check on monthly point value. |
| `settlements-employers-2024` | `settlements-employers-2024.pdf` | https://www.gov.il/BlobFolder/dynamiccollectorresultitem/employers-info-090124/he/IncomeTax_employers-info-090124.pdf | 2026-06-03 | `c4b5ae05…121f` | ITA employers info on 2024 settlement benefit — covers the year's settlement rule (rate %, ceiling). |
| `settlements-nevo-2024` | `settlements-nevo-2024.html` | https://www.nevo.co.il/law_html/law00/224303.htm | 2026-06-03 | `3f258264…de5b` | **Authoritative list of eligible settlements for 2024** as published in the official gazette (Nevo HTML). Use to populate `settlements/2024.ts`, including the user's RNG / מדרשת בן גוריון case. |
| `btl-rates-2024` | `btl-rates-2024.pdf` | https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/שינוי בתשלום דמי ביטוח לאומי ודמי ביטוח בריאות לשנת 2024.pdf | 2026-06-03 | `b503e436…94ce` | BTL rates change for 2024 — feeds `bituach_leumi_rates`. |

## How to populate

1. Read the PDF (PDF text extraction or visual inspection).
2. Rewrite `Calculator/rules/2024.ts` — replace the `makeScaffoldRules(2024)` call with a literal `YearRules` object, populating each parameter with `value: <from PDF>, cite: '<cite_key>'`.
3. Populate `Calculator/rules/settlements/2024.ts` from `settlements-nevo-2024.html` (authoritative list) + cross-check against `settlements-employers-2024.pdf`. **Include מדרשת בן גוריון** with its 2024 rate.
4. For high-stakes values (brackets, `point_value_annual`), confirm they match between `madrich-2024` and `annual-deductions-2024` (two-source rule per ADR-002).
5. Run `node --experimental-strip-types Calculator/rules/yoy-diff.ts 2023 2024` and eyeball the diff.
6. Flip `verification.sign_off` to `'verified'` and `yoy_diff_reviewed: true` after sign-off.

## Known gaps

- `brackets-press-2024.pdf` (press-income-tax-brackets PDF) — could not locate at the analog URL pattern. Not blocking — two-source coverage on brackets is already met via `madrich-2024` + `annual-deductions-2024`.
- Filing-exemption regulation as a self-archived ITA artifact — not separately captured. The mandatory-filing thresholds are stated inside `madrich-2024`. If a stronger source is needed, the canonical legal text lives at https://he.wikisource.org/wiki/תקנות_מס_הכנסה_(פטור_מהגשת_דין_וחשבון) and the original רשומות notice on Nevo.
