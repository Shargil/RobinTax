# Foreign income (תוספת ד — foreign-source income / foreign tax paid)

**Profile key:** `foreign_income`
**Status:** v2-stub — intake skips this branch until promoted.

## When promoted, ask
- **Gate:** "Did you have any income from outside Israel — foreign salary, dividends, rental, crypto disposal, freelance?"
- **Follow-ups:** rough total per year (band), source country, whether foreign tax was withheld (אישור על ניכוי מס במקור בחו"ל).

## Will seed
- **Doc:** `foreign-tax-paid` confirmation — playbook not yet written.
- **Calculator rule keys fed:** `mandatory_filing.foreign_income_nis` (triggers mandatory filing above the threshold), `mandatory_filing.foreign_account_balance_nis`, foreign-tax-credit mechanics (not yet in engine).

Why deferred: cross-border tax is a different beast — treaty mechanics, FX conversion rules, FBAR-style account-balance reporting. Out of scope for v1 (salaried-Israeli-resident default).
