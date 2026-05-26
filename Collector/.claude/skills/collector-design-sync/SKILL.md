---
name: collector-design-sync
description: Use proactively whenever Collector (services in Collector/) behavior, architecture, data formats, confidence rules, or flows change — and whenever editing any file in Collector/design/. Keeps the Smart Replay HLD and its embedded diagram the source of truth so code never drifts ahead of the design. Fire even without explicit invocation the moment Collector design or implementation work is mentioned.
---

# Collector Design Sync

## Goal
Keep `Collector/design/` (the Smart Replay HLD + diagram) accurate and in sync whenever the design or its implementation changes.

## When to use
- Editing anything in `Collector/design/`.
- Changing Collector behavior, architecture, MCP tool surface, action-store format, confidence formulas/zones, or the record/replay/fallback flow.
- Adding or removing a Collector dependency that the HLD names (Playwriter, Chrome extension, CDP relay port).
- Reviewing a Collector change before commit.

## Rules
- **HLD is source of truth.** `design/smart_replay_hld.md` leads; update it in the *same* change as the code, never after — stale design is worse than none.
- **The diagram is the hand-maintained SVG.** `smart_replay_hld.svg` is canonical and edited by hand (no generated source). When the flow/labels change, edit the SVG markup directly so it matches the prose — a stale diagram misleads more than no diagram.
- **One fact, one place.** Confidence formulas/zones live in `design/confidence_scoring.md`; the HLD references them. If a number changes, change it there and check the HLD's diagram/tables still agree — don't fork the value.
- **Cross-doc links must resolve.** The HLD's "Related docs" and CLAUDE.md's design pointers must point at files that exist.
- **Big decisions become ADRs.** If a change reverses or replaces a design choice (e.g. drop Playwriter, switch JSON→SQLite), write/supersede an ADR in `Collector/decisions/` — don't just rewrite prose. See `monorepo-mega-skill`.

## Checklist
1. State what changed in one line (behavior / format / flow / dependency / decision).
2. Update `design/smart_replay_hld.md` prose to match.
3. Update `smart_replay_hld.svg` (edit the markup by hand) if the flow, nodes, or labels changed.
4. If confidence numbers changed, edit `design/confidence_scoring.md` and reconcile the HLD.
5. Check the other design docs (`playwriter_internals.md`, `open_source_landscape.md`) for now-false statements.
6. Verify all cross-doc links and the CLAUDE.md design pointers still resolve.
7. If a design *decision* changed, add/supersede an ADR in `Collector/decisions/` and update its `README.md`.
8. Mark `smart_replay_hld.svg` stale (regenerate from the Mermaid, or delete) — note it in the change.

## Examples
- *Action-store gains a `lastSuccess` field* → add it to the HLD's "Action store format" JSON, the field table, and the Mermaid store node; no ADR needed.
- *Switch from JSON-per-site to SQLite* → supersede the relevant ADR, update HLD "Key design decisions" + diagram, flag the SVG stale.

## Anti-patterns
- Never let `smart_replay_hld.svg` fall out of step with the prose — if you change the flow, change the SVG in the same edit.
- Never duplicate a confidence number into the HLD when it already lives in `confidence_scoring.md`.
- Never ship a Collector code change that contradicts the HLD without updating the HLD in the same change.

## Related files
- `Collector/design/smart_replay_hld.md` — the HLD (`smart_replay_hld.svg` is the canonical, hand-maintained diagram)
- `Collector/design/confidence_scoring.md` — single source for confidence formulas/zones
- `Collector/CLAUDE.md` — names the HLD as source of truth
- `.claude/skills/monorepo-mega-skill/SKILL.md` — ADR vs CLAUDE.md vs skill rules
