# Filing scope

**Profile section:** `## Filing scope`
**Status:** v1
**Order:** 1 (asked first — gates everything else)

## Questions

This branch has no single gate; both questions always asked.

### Q1 — Years to file
**Key:** `years`
**Question:** "Which tax years do you want to claim a refund for? You can pick more than one — Israeli refunds are claimable up to 6 years back."
**Options (multiSelect):** 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | I don't know
**On "I don't know":** default to 2022–2024 (the 3 most recent fully-closed years) and note in the profile that the user wasn't sure — `/robintax` can re-ask later when more docs arrive.

### Q2 — Income mode
**Key:** `income_mode`
**Question:** "How did you earn money in those years?"
**Options:** Salary only (שכיר) | Self-employed (עצמאי) | Both | Mostly capital income (interest / dividends / capital gains)
**On non-"Salary only":** mark `Intake` complete but flag `income_mode != salaried` in the profile and have the `intake` skill print:
> RobinTax v1 supports salaried (שכיר) refunds only. Self-employed / capital-heavy returns need a CPA. I'll still seed the salaried docs you have — they're useful — but I won't run `/calc-refund` until v2.

This is a soft block, not a hard stop.

## Seeds

- **Always:** `form-106` for every declared year. The 106 is the universal salaried artifact; no eligibility branch gates it.
- **Calculator rule keys fed:** none directly — `years` and `income_mode` are meta-fields the engine uses to pick which `Calculator/rules/<year>.ts` to load and whether to run at all.
