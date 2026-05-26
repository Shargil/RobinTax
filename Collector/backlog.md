# Collector backlog

Features and ideas we explicitly deferred from v1. Each entry says **what** and **why we deferred** so future-us can judge whether it's still worth doing when the context has changed.

For active design, see [`design/smart_replay_hld.md`](design/smart_replay_hld.md).
For shipped behavior, read the code.

---

## Remote update channel for site recordings

Skill checks a remote source (GitHub raw URL, npm tag, or hosted endpoint) for a newer version of `flows/{site}.ts` and pulls it in if found, otherwise uses the local copy.

**Why deferred:** v1 has one user (Yam) and a handful of sites. Local-only files bundled with the skill are enough. The day there's a second user, an update channel becomes worth its complexity (versioning, trust/signing, fallback semantics).

**When to revisit:** second user, OR a site DOM changes faster than we can ship a release.

---

## DOM hash gate

Fingerprint key landmark elements on each replay; skip cached steps straight to LLM heal if the hash doesn't match the recording.

**Why deferred:** optimization to avoid a wasted-but-fast replay attempt. Saves ~2–5s on heal cases. Not worth the fingerprinting logic until we have repeat-failure telemetry showing it'd pay off.

---

## Numeric confidence scoring + decay

`score × 1.05 + 0.02` on success, `score × 0.85 − 0.05` on failure, `× 0.99/day` decay. Plus the four confidence zones (Trusted / Shaky / Degraded / Dead).

**Why deferred:** the constants are guesses without real failure data. v1 uses a binary `origin: "recorded" | "llm-healed"` flag, which is enough to route decisions for one user. Real scoring becomes worthwhile when we have aggregate selector survival data across users/runs.

---

## Selector fallback hierarchy beyond `aria-ref` / role+text

Tiers 3 and 4 in the HLD: visible text match, fuzzy CSS class match via Levenshtein.

**Why deferred:** the pivot to code-module flows means we don't hand-roll a step-selector record format. Idiomatic Playwright locators (`get_by_role`, `get_by_text`) already incorporate text + role + ARIA fallback. The remaining tail (Levenshtein on classnames) is rarely the difference between recovery and a forced heal.

---

## Alerting when LLM heal also fails

HLD calls for an alert path when even the LLM can't repair a step. v1 just fails loudly in the terminal.

**Why deferred:** v1's only "user" is you, and you're already watching the terminal. Wire up real alerting (Slack? email?) when there's a user who isn't.

---

## SQLite upgrade for action store

JSON-per-site → SQLite as the recording set grows.

**Why deferred:** moot under the code-module pivot. Each flow is a `.ts` file. SQLite would only re-enter the picture if we go back to a runtime-recorded JSON model (e.g., for crowd-sourced selector data across users).

---

## Auto-capture of typed input during recording

`playwright codegen` captures typed input today (that's how `state` and search-box flows record). v1 deliberately doesn't add a runtime recorder, so this is moot for now — but if we later build runtime recording, typed input is a known risk.

**Why deferred:** risk of recording IDs / OTPs / passwords (see [`feedback_codegen_credentials`](../../.claude/projects/-Users-shargil-Documents--------------2026-05-14----------RobinTax/memory/feedback_codegen_credentials.md)). When/if we re-open runtime recording, this needs a sanitization layer: skip `type=password`, prompt before persisting any field with N digits matching an Israeli ID pattern, etc.

---

## Format

When adding to this file:

```markdown
## <Feature name in plain English>

<One-paragraph description of what it does and how it'd work, concretely.>

**Why deferred:** <the actual reason, including stakes — small UX win? optimization? needs more data? blocked on something?>

**When to revisit:** <the trigger that should bring this back: a metric, a new user, a failure pattern, a date>
```

Don't put implementation plans here — those go in `design/` once the feature is approved for the next milestone.
