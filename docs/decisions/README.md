# Architectural decisions (repo-level)

Decisions that shape RobinTax as a whole. Service-local decisions live under `<service>/decisions/`.

Scan filenames first. Open an ADR only when its name suggests it's relevant.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](ADR-001-no-credential-proxy.md) | Never proxy ITA credentials or banking data | accepted |
| [ADR-003](ADR-003-server-data-scope.md) | Server data scope: generated forms and calc results only; never credentials or bank info | accepted |
| [ADR-009](ADR-009-user-owns-login-and-captcha.md) | The user always performs login and CAPTCHA themselves | accepted |
| [ADR-010](ADR-010-explain-and-gate-scary-actions.md) | Explain the reason before any action; gate "very scary" actions on explicit consent | accepted |
| [ADR-011](ADR-011-user-journey-ledger.md) | One per-user journey ledger as the cross-skill source of truth | accepted |
| [ADR-012](ADR-012-apple-reminders-for-pending-docs.md) | Apple Reminders substrate for pending-doc reminders + cohort bundling | accepted |
| [ADR-013](ADR-013-user-profile-and-intake.md) | User profile + intake as the first journey stage | accepted |
| [ADR-014](ADR-014-intake-journey-reconciliation.md) | Intake↔journey reconciliation: no orphaned expectations | accepted |

> ADR numbers are not reused. Gaps (002, 004–008) are historical — those ADRs were specific to the Chrome-extension architecture that was retired on 2026-05-22. New ADRs continue from the next unused number.

## Process

1. Before deciding: scan filenames here. Read related ADRs.
2. If an existing ADR conflicts: supersede it (new ADR, mark old `superseded by ADR-NNN`) or update it. Never silently contradict.
3. After deciding: write a new ADR using the template in the monorepo mega skill.
4. Update this index.
