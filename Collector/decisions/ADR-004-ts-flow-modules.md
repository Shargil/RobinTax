# ADR-004 (Collector): Per-site TypeScript flow modules, not a JSON action store

**Date:** 2026-05-26
**Status:** accepted
**Supersedes:** the original Smart Replay HLD's `actions/{site}.json` format and four-tier selector fallback.

## Context

The original Smart Replay HLD stored each site's recorded flow as a JSON file with one entry per step:

```json
{
  "xpath": "/html/body/main/nav/button[2]",
  "ariaRef": "aria-ref=e5",
  "cssSelector": "nav > .reports-link",
  "fallbackText": "דוחות",
  "actionType": "click",
  "confidence": 0.90,
  "origin": "recorded"
}
```

The replay engine would interpret this schema, try selectors in a four-tier fallback hierarchy (XPath → ariaRef → text → fuzzy CSS), and write LLM-healed steps back to the same JSON with `origin: "llm-healed"` and a confidence number.

The research scaffold ([`research/flows/ita.py`](../research/flows/ita.py)) took a different approach: per-site Python modules with idiomatic Playwright (`page.get_by_role`, `expect_popup`, `expect_download`). That scaffold actually works for ITA Form 106 today. The JSON action store does not exist yet.

We had to decide which to carry into v1.

## Decision

**Per-site TypeScript flow modules.** Each site is `Collector/skill/src/flows/{site}.ts`, exporting `async function run(page, deps)`. Each action is wrapped in a `step("name", fn)` helper so the replay engine knows which step broke when a `fn` throws.

There is no separate JSON cache, no selector fallback hierarchy, and no numeric confidence scoring in v1. The flow module IS the cache. LLM heal-back patches the flow module via Claude Code's Edit tool — a git-diffable, reviewable code change.

## Why

- **Idiomatic Playwright locators already do what tiers 1–3 of the JSON fallback hierarchy did.** `get_by_role("button", { name: /^הורד/ })` incorporates role + ARIA + text fallback at the locator level. We don't need a hand-rolled tier ladder on top.
- **A JSON schema would have to express popups, frame locators, downloads, year loops, regex matchers, and waits.** The research scaffold needs all of those for ITA. Building a config schema for them reinvents half of Playwright's API. Code is the right format.
- **Heal-back as a code patch is more reviewable than a JSON write-back.** The diff says exactly what selector changed and why. `git blame` shows which heal happened when. JSON write-backs are opaque.
- **Type safety + IDE support.** Editing a `.ts` file with autocomplete + jump-to-definition is faster than editing a JSON file blind. Important for the sanitization step in [ADR-003](./ADR-003-recording-via-playwright-codegen.md).
- **Smaller v1 surface area.** Drops the four-tier fallback engine, the DOM hash gate, the numeric confidence scoring, the score-decay sweeper, and the JSON write-back logic — all of which are deferred to `backlog.md` until we have failure telemetry to calibrate.

## Alternatives considered

- **Keep the JSON action store.** Rejected: reinvents Playwright's locator semantics as a config schema; high cost for v1 with no offsetting win.
- **JSON for selectors, TS for control flow.** Rejected: two formats to keep in sync; the boundary is arbitrary.
- **YAML steps with embedded JS snippets.** Rejected: worst of both worlds (no type safety, still need a runner, less greppable).

## Consequences

- Easier: zero new schema. The replay engine just imports the module and runs it. LLM heal-back is the existing Edit tool, not a custom write-back path. Each flow file is reviewable as code.
- Harder: a flow change requires shipping the skill (or pulling the file from the repo at runtime). v1 ships the flow files bundled with the skill; an over-the-air update channel for flows is deferred (see `backlog.md`).
- Tradeoff accepted: a JSON cache would have been easier to mutate from a non-Claude environment. We bet that LLM-heal-via-Edit-tool is enough for v1, and revisit if we ever need a non-Claude runtime to author patches.

## Related

- [ADR-003](./ADR-003-recording-via-playwright-codegen.md) — how flows get recorded into the modules in the first place.
- [`../backlog.md`](../backlog.md) — deferred items (DOM hash gate, numeric scoring, fallback hierarchy, remote update channel).
- [`../design/smart_replay_hld.md`](../design/smart_replay_hld.md) — v1 HLD.
