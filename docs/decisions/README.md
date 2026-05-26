# Architectural decisions (repo-level)

Decisions that shape RobinTax as a whole. Service-local decisions live under `<service>/decisions/`.

Scan filenames first. Open an ADR only when its name suggests it's relevant.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](ADR-001-no-credential-proxy.md) | Never proxy ITA credentials or banking data | accepted |
| [ADR-003](ADR-003-server-data-scope.md) | Server data scope: generated forms and calc results only; never credentials or bank info | accepted |
| [ADR-009](ADR-009-user-owns-login-and-captcha.md) | The user always performs login and CAPTCHA themselves | accepted |
| [ADR-010](ADR-010-explain-and-gate-scary-actions.md) | Explain the reason before any action; gate "very scary" actions on explicit consent | accepted |

> ADR numbers are not reused. Gaps (002, 004–008) are historical — those ADRs were specific to the Chrome-extension architecture that was retired on 2026-05-22. New ADRs continue from the next unused number (011).

## Process

1. Before deciding: scan filenames here. Read related ADRs.
2. If an existing ADR conflicts: supersede it (new ADR, mark old `superseded by ADR-NNN`) or update it. Never silently contradict.
3. After deciding: write a new ADR using the template in the monorepo mega skill.
4. Update this index.
