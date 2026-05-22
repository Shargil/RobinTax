---
name: monorepo-mega-skill
description: How this monorepo organizes its persistent memory for AI agents — CLAUDE.md hierarchy, ADRs (decisions), and skills (workflows). MUST be used whenever making a significant architectural decision, creating or editing any CLAUDE.md file, creating or editing any skill, or changing the monorepo's folder structure. Use even when not explicitly asked, the moment any of those triggers appear.
---

# Monorepo Mega Skill

This skill is the contract for how the repo stores its persistent memory for AI agents.
Follow it any time the triggers below apply.

> Status: RobinTax is currently a single app. This skill describes the target structure for when services split out. Apply selectively until then.

## When to use this skill

Trigger when any of these happen:

- A significant architectural decision is being made (stack, pattern, library, contract, boundary).
- Any `CLAUDE.md` file is being created or edited (root or service-level).
- Any skill is being created or edited.
- The monorepo folder structure is changing.

If none of these apply, this skill does not apply.

## The four artifacts

| File                          | Role                                                | Loaded when               |
|-------------------------------|-----------------------------------------------------|---------------------------|
| `CLAUDE.md`                   | System map / ambient memory (**repo facts**)        | Every session in scope    |
| `ADR-NNN-*.md`                | Decision archive / historical "why"                 | On demand by filename     |
| `SKILL.md`                    | Reusable operational workflow                       | When triggered            |
| `knowledge-base/<topic>.md`   | **External-world domain facts** (cited, dated)      | On demand via KB router   |

Different jobs. Do not merge them.

If unsure where something belongs, ask: is this a **repo fact** (CLAUDE.md), an **external-world fact** (KB topic), a **decision** (ADR), or a **procedure** (skill)?

### When to use the knowledge base vs CLAUDE.md

- Fact about *this codebase* (stack, conventions, boundaries, file layout) → `CLAUDE.md`.
- Fact about *the outside world* that needs citation + verification date (tax law, regulations, third-party API behavior, vendor pricing) → `knowledge-base/<topic>.md`.
- Rule of thumb: if the fact has a **source** and could be **wrong later**, it belongs in the KB so it can be re-verified.

Domain knowledge lives in `.claude/skills/knowledge-base/` — see that skill's `BEST-PRACTICES.md` for content rules.

## Project structure

Every service follows the same shape: per-service `CLAUDE.md`, `.claude/skills/`, and `decisions/`.

```
repo/
├── CLAUDE.md                          # root: system map only
├── .claude/
│   └── skills/                        # repo-wide skills (auto-loaded every session)
│       └── monorepo-mega-skill/
│           └── SKILL.md
├── docs/
│   └── decisions/                     # repo-level ADRs
│       ├── README.md                  # index table
│       ├── ADR-001-monorepo-tooling.md
│       └── ADR-002-shared-contracts.md
└── services/
    ├── backend/
    │   ├── CLAUDE.md                  # backend constraints, boundaries
    │   ├── .claude/
    │   │   └── skills/                # backend-only skills (auto-discovered when working here)
    │   │       ├── add-endpoint/
    │   │       │   └── SKILL.md
    │   │       └── db-migration/
    │   │           └── SKILL.md
    │   └── decisions/                 # backend ADRs
    │       ├── README.md
    │       ├── ADR-001-prisma-orm.md
    │       └── ADR-002-zod-validation.md
    ├── chrome-extension/
    │   ├── CLAUDE.md
    │   ├── .claude/
    │   │   └── skills/
    │   └── decisions/
    └── claude-plugin/
        ├── CLAUDE.md
        ├── .claude/
        │   └── skills/
        └── decisions/
```

## How skill auto-invocation works

Two mechanisms working together. Use both.

### 1. Nested directory discovery (location)

Claude Code auto-discovers `.claude/skills/` in every parent of your current directory **and** in nested subdirectories you touch during a session. Practically:

- Repo-wide skills → `repo/.claude/skills/` (always loaded).
- Service-only skills → `services/<name>/.claude/skills/` (loaded when Claude reads or edits files in that service).

You don't have to manually invoke service skills — putting them in the service's nested `.claude/skills/` is the structural trigger.

### 2. Description-based triggering (the real driver)

Claude decides whether to *use* a discovered skill based on its `description` field. The description is the primary trigger mechanism — write it so Claude knows exactly when to fire.

Good description (service-scoped, action-oriented):
> `Use when adding any new API endpoint to the backend service (services/backend/). Covers Zod schema, route, service layer, repository, tests. Use proactively the moment endpoint work is mentioned, even without explicit invocation.`

Bad description (vague, no context):
> `Helps with endpoints.`

For service-specific skills, the description should explicitly name the service and the triggering action. This makes auto-invocation reliable even if nested discovery is flaky in your Claude Code version.

### 3. Belt-and-suspenders: list skills in the service CLAUDE.md

In each service's `CLAUDE.md`, include a short section like:

```markdown
## Available skills for this service

- `add-endpoint` — use when adding a new API endpoint
- `db-migration` — use when changing the database schema
```

This gives Claude an explicit pointer even when description matching is uncertain.

## CLAUDE.md guidelines

CLAUDE.md is the **map**, not the encyclopedia. Terse, scannable, current.

### What belongs in **root** CLAUDE.md

- Repo purpose (1–2 lines).
- Service map: what each top-level folder is and how they relate.
- Top-level conventions (language, package manager, build tool).
- Pointer to `docs/decisions/` with naming convention.
- Pointer to repo-wide skills.

### What belongs in a **service** CLAUDE.md

- What this service is (1–2 lines).
- Local stack and key dependencies.
- Boundaries and constraints (what this service does **not** do).
- Pointer to local `decisions/` and `.claude/skills/`.
- Anti-patterns specific to this service.

### What does NOT belong in CLAUDE.md

- Long prose or marketing language.
- Step-by-step workflows → those are skills.
- Decision rationale → that's an ADR.
- Duplicated content from README or other docs.
- Implementation details that change weekly.

### Encourage

- Bullet rules over paragraphs.
- Constraints, boundaries, anti-patterns.
- One-line examples.
- A one-line "why" on any non-obvious rule.

### Avoid

- Essays and philosophy.
- Duplicated rules across files.
- Stale implementation notes.
- Anything that won't be true in 3 months.

**Size:** under ~200 lines per CLAUDE.md. If it grows past that, split into ADRs or skills.

## Skill guidelines

A skill is an **executable workflow**. It tells the AI *what to do*, not *what is true*.

### Required structure

```markdown
---
name: skill-name
description: One sentence describing when to invoke this skill
---

# Skill Name

## Goal
What this skill accomplishes in one line.

## When to use
- Trigger 1
- Trigger 2

## Rules
- Rule (with one-line why)
- Rule (with one-line why)

## Checklist
1. First step
2. Second step
3. Third step

## Examples
Concrete example of correct application.

## Anti-patterns
- Never do X
- Never do Y

## Related files
- Pointer to relevant code paths or ADRs
```

### Keep skills

- Short (under 100 lines when possible).
- Operational (action verbs).
- One workflow per skill.
- Example-heavy.

A skill is a **flight checklist**, not a textbook.

## Decision guidelines (ADRs)

Both the repo root and each service have a `decisions/` folder. ADRs live at the level they apply to. Repo-wide decisions go in `docs/decisions/`. Service-local decisions go in `services/<name>/decisions/`.

### Process

1. **Before deciding:** scan filenames in the relevant `decisions/` folder. Filenames should be descriptive enough to know from the name alone whether the ADR is relevant. Read any that look related.
2. **If an existing ADR conflicts:** either supersede it (write a new one and mark the old one `superseded by ADR-NNN`) or update it. Never silently contradict an existing decision.
3. **After deciding:** write a new ADR using the template below.
4. **Update the index** in that folder's `README.md`.

### File naming

```
ADR-NNN-short-descriptive-name.md
```

Examples:
- `ADR-001-monorepo-tooling.md`
- `ADR-004-auth-provider.md`
- `ADR-007-event-bus-vs-direct-calls.md`

The filename alone must tell Claude whether to open the file. Be specific.
Bad: `ADR-004-decision.md`. Bad: `ADR-004-misc.md`.

### ADR template

```markdown
# ADR-NNN: <Decision title>

**Date:** YYYY-MM-DD
**Status:** proposed | accepted | superseded by ADR-NNN

## Context
What problem motivated this? 2–5 sentences.

## Decision
What we picked. 1–3 sentences.

## Why
The causal reason. What pain does this avoid? What does it enable?

## Alternatives considered
- Option A — rejected because ...
- Option B — rejected because ...

## Consequences
- What becomes easier
- What becomes harder
- What we accept as a tradeoff
```

The **Why** section is non-negotiable. AI agents follow rules far more reliably when they understand the causal reason, not just the rule.

## Repository rules

- Keep root CLAUDE.md small and high-level.
- Prefer progressive disclosure: load detail only when needed.
- Push detailed workflows into skills.
- Push major decisions into ADRs.
- Avoid duplicated rules. Single source of truth per rule.
- Avoid stale docs. If a rule is no longer true, remove or supersede it.
- Prefer concise bullet rules over essays.
- Optimize for token efficiency — assume every word costs.
- Write for AI readers: constraints, examples, anti-patterns over prose.

## The four layers, one more time

- **CLAUDE.md** — system map / ambient memory, **repo facts** (always loaded in scope).
- **ADRs** — decision archive / historical "why" (loaded on demand by name).
- **Skills** — reusable operational workflows (loaded when triggered).
- **Knowledge base** — **external-world domain facts**, cited and dated (loaded on demand via KB router).

If you can't decide where something belongs, ask:
is this a **repo fact** (CLAUDE.md), an **external-world fact** (KB topic), a **decision** (ADR), or a **procedure** (skill)?
