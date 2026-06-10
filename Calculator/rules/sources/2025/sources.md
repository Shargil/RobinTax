# 2025 — archived sources manifest

Per-year provenance for `Calculator/rules/2025.ts`. One entry per archived artifact.
Each row records: where it came from, when it was fetched, and a SHA256 over the file.
The `cite_key` matches an entry in `2025.ts`'s `citations` map (to be filled in when the
year is populated from these PDFs).

> **Context (important):** The Knesset froze indexation of tax-law NIS amounts for tax years 2025–2027 (Arrangements Law). Many 2025 NIS amounts therefore equal their 2024 values — the YoY-diff 2024→2025 should be mostly unchanged on indexed parameters, and any non-zero change is structurally interesting and warrants double-checking. (Source: gov.il `sa161224-4`.)

| cite_key | file | url | fetched | sha256 | covers |
|---|---|---|---|---|---|
| `madrich-2025` | `guide-individuals-2025.pdf` | https://www.gov.il/BlobFolder/generalpage/income-tax-guide-knowyourright/he/Guides_IncomeTax_da-2025.pdf | 2026-06-03 | `5012033e…60d0` | **Primary.** Annual filing guide "דע זכויותיך וחובותיך 2025" — brackets, point value, status credits, donations §46, pension, separate rates, mandatory-filing thresholds. Backs most parameters. |
| `annual-deductions-2025` | `annual-deductions-2025.pdf` | https://www.gov.il/BlobFolder/generalpage/income-tax-annual-deductions-booklet/he/generalInformation_income-tax-yearly-deductions-booklet_yearly-deductions-booklet-2025.pdf | 2026-06-03 | `c86ad63b…7066` | **Two-source check for brackets + point value.** Annual deductions calculation booklet for tax year 2025. |
| `monthly-deductions-2025` | `monthly-deductions-2025.pdf` | https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2025.pdf | 2026-06-03 | `41496dd3…fd73` | Monthly deductions booklet (Jan 2025). Cross-check on monthly point value. |
| `form-135-2025` | `form-135-2025.pdf` | https://www.gov.il/BlobFolder/service/reporting-and-payment-2025-annual-tax-report-for-individuals/he/Service_Pages_Income_tax_annual-report-2026_135-2025-ACC.pdf | 2026-06-03 | `c1017830…9378` | Form 135 for tax year 2025 (filed in 2026). Useful reference for input field schema when wiring the engine to the actual filing. |
| `settlements-employers-2025` | `settlements-employers-2025.pdf` | https://www.gov.il/BlobFolder/dynamiccollectorresultitem/employers-info-060125/he/IncomeTax_employers-info-060125.pdf | 2026-06-03 | `b1b27488…6ea9` | ITA employers info on 2025 settlement benefit — covers the year's settlement rule (rate %, ceiling). |
| `settlements-procedure-2025` | `settlements-procedure-2025.pdf` | https://www.gov.il/BlobFolder/policy/procedures-060125/he/IncomeTax_procedures-060125.pdf | 2026-06-03 | `48a5debf…0ce9` | Procedure for issuing the residency certification for 2025 (the user's RNG cert path). |
| `btl-rates-2025-jan` | `btl-rates-2025-jan.pdf` | https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/שינוי בתשלום דמי ביטוח לאומי ודמי ביטוח בריאות בחודש ינואר 2025.pdf | 2026-06-03 | `437378a7…fa13` | BTL rates change effective Jan 2025. |
| `btl-rates-2025-feb` | `btl-rates-2025-feb.pdf` | https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/שינוי בתשלום דמי ביטוח לאומי ודמי ביטוח בריאות לשנת 2025 החל מחודש פברואר 2025.pdf | 2026-06-03 | `38cca39e…eb48` | BTL rates change effective Feb 2025 — supersedes the Jan version for most cases. |
| `btl-self-employed-2025` | `btl-self-employed-2025.pdf` | https://www.btl.gov.il/Insurance/HozrimBituah/Hozrim/מקדמות ודמי ביטוח לעצמאים 2025.pdf | 2026-06-03 | `d41923c9…c36ab` | Self-employed BTL advances + rates 2025. |

## How to populate

1. Read the PDF (PDF text extraction or visual inspection).
2. Rewrite `Calculator/rules/2025.ts` — replace the `makeScaffoldRules(2025)` call with a literal `YearRules` object, populating each parameter with `value: <from PDF>, cite: '<cite_key>'`.
3. Populate `Calculator/rules/settlements/2025.ts` from `settlements-employers-2025.pdf` (need a separate list source if this PDF doesn't include the full list — search for the Nevo/gazette annex). **Include מדרשת בן גוריון** with its 2025 rate, only if RNG is on the 2025 list.
4. For high-stakes values (brackets, `point_value_annual`), confirm they match between `madrich-2025` and `annual-deductions-2025` (two-source rule per ADR-002).
5. Run `node --experimental-strip-types Calculator/rules/yoy-diff.ts 2024 2025` once 2024 is populated; eyeball the diff with the indexation freeze in mind (many leaves should be unchanged).
6. Flip `verification.sign_off` to `'verified'` and `yoy_diff_reviewed: true` after sign-off.

## Known gaps

- `brackets-press-2025.pdf` (press-income-tax-brackets PDF) — could not locate at the analog URL pattern. Not blocking — two-source coverage on brackets is already met via `madrich-2025` + `annual-deductions-2025`.
- 2025 settlements **full list** (analog of `settlements-nevo-2024.html`) — not separately archived. The Nevo annex for 2025 should be searched and added before populating `settlements/2025.ts`. The two ITA PDFs (`settlements-employers-2025` + `settlements-procedure-2025`) describe the *rule* but may not list every qualifying settlement.
- Filing-exemption regulation as a self-archived ITA artifact — not separately captured. The mandatory-filing thresholds are stated inside `madrich-2025`.
