# Pension — self deposits (§45A קופת גמל לקצבה, §45A life-insurance)

**Profile key:** `pension_self`
**Status:** v2-stub — intake skips this branch until promoted.

## When promoted, ask
- **Gate:** "Did you deposit your own money into a pension fund (קופת גמל לקצבה) or life-insurance policy (ביטוח חיים) on top of what your employer deposited?"
- **Follow-up:** rough annual amount per filing year (band).

## Will seed
- **Doc:** `pension-fund-self-deposit` and/or `life-insurance-deposit` confirmation — playbooks not yet written.
- **Calculator rule keys fed:** `pension` (`credit_rate_pension_fund` for קופת גמל, `credit_rate_life_insurance` for ביטוח חיים, both bounded by shared `credit_base_ceiling_nis`).

Why deferred: the standard salaried 106 already captures employer + employee mandated pension deposits; the §45A 35% credit only adds value on *voluntary* extra deposits, which most salaried users don't make. Worth surfacing once we have higher-net-worth users.
