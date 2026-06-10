# Household

**Profile section:** `## Household`
**Status:** v1
**Order:** 2

Asked as one `AskUserQuestion` panel ("Section 2 of 6: Household") so the user sees the related questions together.

## Questions

No single gate — Q1 (marital) conditionally opens Q2 (spouse income).

### Q1 — Marital status
**Key:** `marital`
**Question:** "What was your marital status during the years you're filing?"
**Options:** Single (רווק/ה) | Married (נשוי/אה) | Divorced / separated (גרוש/ה) | Widowed (אלמן/ה) | Changed during the period

### Q2 — Spouse has income (asked only if `marital == Married` or `Changed during the period`)
**Key:** `spouse_income`
**Question:** "Did your spouse have taxable income (salary, business, capital)?"
**Options:** Yes | No | I don't know

### Q3 — Kids gate
**Key:** `has_kids`
**Question:** "Do you have children?"
**Options:** Yes | No | I don't know

### Q3a (follow-up, only if `has_kids != No`)
**Key:** `kids_count`
**Question:** "How many? And roughly what age were they at the end of each filing year?"
**Free-text** — the only free-text field in v1 intake. The walker stores the raw answer verbatim; `calc-refund` parses it when it builds the children rule input.

## Seeds

- **Docs (when `marital == Married` and `spouse_income == Yes`):** `form-106` for the spouse too (added per declared year — annotate the ledger row with `(spouse)`).
- **Docs (when `marital == Married` and `spouse_income == unknown`):** seed spouse `form-106` as `todo` (pessimistic include — the 106 itself will reveal whether they had income).
- **Docs (when `has_kids != No`):** no doc needed in v1. Calculator applies the points from declared ages alone — birth certificates are only needed for ITA dispute, not for filing.
- **Calculator rule keys fed:**
  - `children_points` (from `kids_count` / ages)
  - `single_parent_points` (from `marital == Divorced/Widowed` + `has_kids == Yes`)
  - Joint-vs-separate filing election (from `marital` + `spouse_income`)
