---
section: <e.g. 39A, 11, 35>
slug: <kebab-case, e.g. soldier-39a>
status: draft
rule_key: <YearRules key, e.g. soldier_points — used by drift tests>
last_verified: <YYYY-MM-DD>
verified_against: [<source-ids: madrich-YYYY, kolzchut>]
---

# §<section> — <Rule name> (<Hebrew name>)

## TL;DR
<One paragraph: who, what (credit/deduction/exemption), how much, how long. Include a current-year max-benefit number where possible.>

## The law
- **Statutes:**
  - <Primary statute, e.g. Income Tax Ordinance §X>
  - <Secondary statute if any>
- **Hebrew name:** <full Hebrew name>
- **Plain English:** <one-sentence summary>

## Sources
| Source | Where | Last fetched | Role |
|---|---|---|---|
| Kolzchut | <url> | <YYYY-MM-DD> | Primary cross-check |
| ITA Madrich <year> | `Calculator/rules/sources/<year>/<file>.pdf`, lines <range> | <YYYY-MM-DD> | Statutory interpretation |
| <other> | | | |

## Eligibility
**Gate (all required):**
1. <condition>
2. <condition>

<Threshold tables, tracks, sub-categories — whatever the rule needs.>

## Edge cases
- **<case name>** — <what happens, with Hebrew quote if available>
- **<case name>** — <...>
- **Stacking** — <how this credit interacts with other credits / deductions>
- **Cannot generate refund beyond tax owed** — <if a credit, mention the cap explicitly>
- **Retroactive claims** — <window in years, typically 6>

## Formula
```
<pseudocode for the math — match the engine function. Include all tier dispatch, pro-rata, caps.>
```

## Required documents
| Doc | Form # | Playbook |
|---|---|---|
| <name> | <e.g. טופס 830> | [`Collector/documents/<slug>.md`](../Collector/documents/<slug>.md) |

## Worked examples
Each row MUST have a 1:1 test in the file listed under `## Implementation map → Tests`, with `[<id>]` in the test name. Drift test enforces this.

| id | Scenario | Expected |
|---|---|---|
| `<kebab-id>` | <inputs in prose> | <expected output> |

## Intake
Read by the `intake` skill walker.

### Gate
- **Question:** "<exact wording shown to user, English with Hebrew terms in parens>"
- **Options:** Yes | No | I don't know
- **Open follow-ups on:** Yes, I don't know

### Follow-ups
- **`<key>`** — "<question>" Options: `...`. **Conditional:** <if applicable>. Reason: <why we ask>. Maps to engine input `<field>`.

### Seeds
- <Logic for which docs to seed in the journey ledger, by branch state. Include n/a conditions.>

### Profile key
`<key>`

## Implementation map
| Slice | File |
|---|---|
| Schema | `Calculator/rules/types.ts` → `<InterfaceName>` |
| Year values | `Calculator/rules/<YYYY>.ts` → `<rule_key>` |
| Math | `Calculator/engine/calculate.ts` → `<functionName>()` |
| Tests | `Calculator/engine/calculate.test.ts` → `describe('<functionName> ...')` |
| Doc playbook | `Collector/documents/<slug>.md` |
| Checklist entry | `Intake/checklist.md` → `<slug>` |
| Profile key | `<memory>/profile.md` → `<key>` |
| Drift check | `tax-rule/drift.test.ts` |

## Monetary point values per year
<Omit if the rule isn't points-based. If points-based, note that `point_value_annual` / `point_value_monthly` live on each year-rule file, not on `<rule_key>`. Capture known future-year values as a forward-looking note.>

## Year values (canonical — TS rule tables MUST mirror this JSON)
```json
{
  "<YYYY>": {
    "<field>": <value>,
    "...": "..."
  }
}
```

## Year-over-year changes
| Year | Change |
|---|---|
| <YYYY> → <YYYY> | <change or "no statutory change"> |

## Open questions
- <known gap, future-year value not yet captured, etc>

## Verification log
- **<YYYY-MM-DD>** — Initial spec. Folded from <list source files>. Gap-passed against <source>. <Conflicts found / none>. — <author>
