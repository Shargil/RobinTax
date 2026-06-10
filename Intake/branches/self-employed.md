# Self-employed (עצמאי)

**Profile key:** `self_employed`
**Status:** v2-stub — captured in the `filing-scope` branch's `income_mode` field. This file exists so the walker has a placeholder for the eventual full intake.

## When promoted, ask
- **Gate:** "Were you registered as עוסק פטור / עוסק מורשה / חברה in any filing year?"
- **Follow-ups:** business type, gross revenue band, bookkeeping format (single/double entry), VAT status.

## Will seed
- **Docs:** business 1301/דוח שנתי, ספרים, VAT periodic filings, רואה חשבון confirmations — all out of scope for v1.
- **Calculator rule keys fed:** essentially a different engine — self-employed needs the §47 self-employed deduction ceilings, §17(5a) self-employed keren hishtalmut, §121B surtax, and the BTL self-employed tier structure.

Why deferred: RobinTax v1 is the salaried refund product. Self-employed returns are a different SKU; this file is here so the intake walker can route self-employed users out with a clear "this isn't for you yet" message (per [`filing-scope.md`](filing-scope.md)).
