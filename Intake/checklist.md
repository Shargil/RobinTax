# Intake checklist — the eligibility surface

The single source of truth for the eligibility intake screens. The `intake` skill walker reads this file, renders the **Items** list as multi-select `AskUserQuestion` panels (4 items per panel, last panel may be 1–4), then collects follow-ups for every checked item from `tax-rule/<slug>.md § Intake`.

## Walker contract

- **Render order:** items appear in the order listed in **Items** below. The walker chunks them into multi-select panels of 4. The thematic groupings (Work / Status / Family) are for editorial purposes — the user just sees a continuous run of panels.
- **Panel question text:** `Select everything that applies` (subtitle in the question body: `If you're not sure, select it and we'll check together`).
- **Selection set:** the walker concatenates all checked items across panels into `selected = [...]` (a flat list of slugs).
- **Disqualifiers:** any selected item flagged `(disqualifier)` triggers §5 DISQUALIFIERS in the walker — a single confirm panel; on confirm, intake short-circuits.
- **Follow-up source:** for every non-disqualifier selected slug whose `tax-rule:` field is **not** `none`, the walker reads `tax-rule/<slug>.md`, parses `## Intake § Follow-ups`, and queues those questions with titles prefixed `{Category} {i}/{N}: ...`.
- **v2-stub slugs** (`tax-rule: none`, no `(disqualifier)` flag): recorded in profile under `## Eligibility branches` as bare `yes` / `unknown` with no follow-ups asked. Calculator does not compute these yet — the eligibility just gets remembered.
- **Free-text slugs** (`(free-text)`): one plain-message prompt at the end of the follow-up batch; the answer lands in profile as free-text under `## Eligibility branches`.

## Item line format

```
- `<slug>` — <Hebrew label> — tax-rule: `<slug-or-none>` <flags>
```

Where `<flags>` is zero or more of: `(disqualifier)`, `(free-text)`. (Items without a tax-rule spec are implicitly v2-stubs — no need to flag.)

## Items

### Group 1 — Work & life events

- `job_change` — החלפתי מקום עבודה — tax-rule: `multi-employer-121-164`
- `btl_income` — קיבלתי כסף מביטוח לאומי (דמי אבטלה, דמי לידה, קצבת זיקנה וכו') — tax-rule: `bituach-leumi-benefits-9`
- `partial_year` — לא עבדתי חלק מהשנה — tax-rule: `multi-employer-121-164`
- `soldier` — שירתתי בצה"ל, בשירות לאומי או בשירות אזרחי (גם שירות חלקי) — tax-rule: `soldier-39a`
- `degree` — סיימתי תואר (ראשון, שני, שלישי, תעודת מקצוע ותעודת הוראה) — tax-rule: `degree-40c-40d`
- `reserves` — עשיתי מילואים — tax-rule: `none`
- `children` — יש לי ילדים — tax-rule: `none`

### Group 2 — Status & investments

- `mortgage_life_insurance` — יש לי ביטוח משכנתא / חיים — tax-rule: `none`
- `immigrant` — אני עולה חדש / תושב חוזר / תושב חוזר ותיק — tax-rule: `none`
- `settlement` — אני מתגורר/ת או התגוררתי ביישוב מזכה — tax-rule: `settlement-11`
- `family_medical_support` — תמכתי בבן משפחה במוסד רפואי — tax-rule: `none`
- `family_disability_75` — יש לי בן משפחה מקרבה ראשונה עם נכות רפואית 75%+ — tax-rule: `none`
- `pension_withdrawal` — משכתי קרן פנסיה או פיצויים — tax-rule: `none`
- `capital_markets` — סחרתי בשוק ההון — tax-rule: `capital-gains-91-92`
- `secondary_sale` — קיבלתי סקנדארי (הייטק) — tax-rule: `secondary-102`
- `married` — אני נשוי/אה או ידוע/ה בציבור — tax-rule: `none`

### Group 3 — Family & special

- `single_parent` — אני חד הורי/ת — tax-rule: `none`
- `alimony` — שילמתי מזונות — tax-rule: `none`
- `maternity_received` — קיבלתי דמי לידה — tax-rule: `bituach-leumi-benefits-9`
- `disabled_child` — יש לי ילד נטול יכולת — tax-rule: `none`
- `medical_disability` — יש לי נכות רפואית — tax-rule: `none`
- `cpa_fees` — שילמתי לרו"ח או יועץ מס — tax-rule: `none`
- `donations` — תרמתי לעמותה — tax-rule: `donations-46`
- `asset_sale_mas_shevach` — מכרתי נכס ושילמתי מס שבח במהלך 6 השנים האחרונות — tax-rule: `none`
- `osek` — אני או בן/בת הזוג עוסק פטור / מורשה — tax-rule: `none` (disqualifier)
- `controlling_shareholder` — אני בעל שליטה בחברה — tax-rule: `none` (disqualifier)
- `foreign_assets_1_5m` — יש לי חשבון בנק / נכסים בחו"ל מעל 1.5 מיליון ₪ — tax-rule: `none` (disqualifier)
- `kibbutz_member` — אני חבר/ת קיבוץ — tax-rule: `none` (disqualifier)
- `non_resident` — אינני תושב ישראל — tax-rule: `none` (disqualifier)
- `other_expenses` — משהו נוסף שלא שאלנו עליו ויכול להיות רלוונטי למס? — tax-rule: `none` (free-text)

## Disqualifier soft-gate

If §4 CHECKLIST yields any `(disqualifier)` slug in `selected`, the walker enters §5 DISQUALIFIERS:

1. One `AskUserQuestion` panel listing each selected disqualifier as a yes/no chip with the Hebrew label as the question text. Panel header: `Quick sanity check`.
2. If **every** disqualifier flips to `no` (user mis-clicked), proceed to §6 FOLLOW-UPS as normal.
3. If **any** disqualifier confirms `yes`, write a partial `<memory>/profile.md` containing:
   - `## Filing scope` — `Years: pending` (intake never got to ask)
   - `## Eligibility branches` — every checklist slug the user selected, marked `yes`/`unknown`/`disqualifier-confirmed`
   - `## Disqualified` — list of confirmed disqualifier slugs
   Then print the v1 short-circuit message verbatim:

```
RobinTax v1 covers salaried wage-earners (שכירים) who file a personal annual return.
Based on what you told me, your case needs a different setup — a CPA who handles
{עוסקים / בעלי שליטה / תושבי חוץ / חברי קיבוץ / נכסים בחו"ל} returns.

I've saved what we collected at <memory>/profile.md. When RobinTax v2 supports
your case, just run /robintax again.
```

(Walker substitutes the bracketed list with the Hebrew labels of confirmed disqualifiers.)

4. STOP. Do not run §6 FOLLOW-UPS. Do not seed the ledger.

## Notes

- Items with real tax-rule specs today: `soldier`, `degree`, `settlement`, `job_change`, `btl_income`, `partial_year`, `secondary_sale`, `donations`, `capital_markets` (job_change/partial_year share `multi-employer-121-164`; btl_income → `bituach-leumi-benefits-9`; secondary_sale → `secondary-102`; donations → `donations-46`; capital_markets → `capital-gains-91-92`). Everything else is intentionally a v2-stub: eligibility recorded, calc does not yet apply.
- To promote a v2-stub: write `tax-rule/<slug>.md` (use `tax-rule/SPEC-TEMPLATE.md`) with a populated `## Intake` section, then flip the `tax-rule: none` reference in this file to `tax-rule: <slug>`. No skill code changes needed.
- The thematic groupings (Work / Status / Family) match the screens the user originally drafted and exist only as editorial sections in this file — the walker concatenates them into one flat list before chunking.
