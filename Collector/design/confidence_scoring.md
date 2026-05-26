# Confidence Scoring — Reference

> **v1 status:** This file describes the v2+ target. v1 ships without numeric
> scoring, the DOM hash gate, or the four-tier selector fallback. Each step's
> origin is a binary `recorded` | `llm-healed` flag, and a failure goes straight
> to LLM heal. See [`../backlog.md`](../backlog.md) for the deferral rationale
> and [`smart_replay_hld.md`](./smart_replay_hld.md) for the v1 architecture.

Confidence scores track how reliably a cached selector works over time.
Every step in the action store carries a score between `0.0` and `1.0`.
The replay engine uses the score to decide whether to trust the cache,
attempt fallbacks, or go straight to LLM.

---

## Update formulas

Based on Anansi (open source self-healing scraper) — the most
thoroughly published real-world implementation.

### On success

```
score = min(1.0, score × 1.05 + 0.02)
```

The additive `+0.02` matters: it lets a score recover from near-zero
faster than multiplication alone. A score of `0.10` reaches `0.50`
after roughly 14 successful replays.

### On failure

```
score = max(0.0, score × 0.85 − 0.05)
```

Intentionally asymmetric — failure punishes harder than success
rewards. Five consecutive failures drop a `0.90` score to `~0.38`,
which crosses the LLM-fallback threshold before a matching success
streak would restore it. Trust is hard to earn, easy to lose.

### Failure severity variants

Not all failures are equal. Adjust the penalty by failure type:

| Failure type | Formula |
|---|---|
| Element not found | `× 0.85 − 0.05` (standard) |
| Wrong element acted on | `× 0.75 − 0.10` (worse — found something, it was wrong) |
| Timeout | `× 0.95` (soft — could be a slow page, not a broken selector) |

### Staleness decay (time-based)

```
score = score × 0.99  per day unused
```

| Days unused | Score remaining (from 0.90) |
|---|---|
| 7 days | ~0.94 |
| 30 days | ~0.74 |
| 60 days | ~0.61 |

This forces periodic re-validation of selectors that haven't been
exercised recently, even if they never explicitly failed.

---

## Starting values by origin

| How the step was created | Initial confidence |
|---|---|
| Hand-recorded (Playwright codegen / dev session) | `0.90` |
| LLM-generated, validated once | `0.60` |
| Healed via fuzzy match (aria-ref / visible text) | `0.70` |

Never start at `1.0` — leave headroom for the score to establish
trust through repeated successful replays.

---

## Confidence zones

| Zone | Range | Replay behaviour |
|---|---|---|
| **Trusted** | 0.85 – 1.0 | Run cached step directly, no fallback attempt |
| **Shaky** | 0.50 – 0.84 | Run cached, but also try aria-ref / text in parallel |
| **Degraded** | 0.25 – 0.49 | Skip cache, go to LLM, use cached selector as hint only |
| **Dead** | 0.0 – 0.24 | Delete step, force re-recording |

Industry reference: Tricentis recommends `90%+` for auto-apply and
manual review below that. Our `0.85` trusted threshold aligns with
this while leaving a "shaky" band that attempts cheaper fallbacks
before calling the LLM.

---

## Selector priority ranking

When replaying a shaky or degraded step, try selectors in this order.
Ranked by stability across DOM changes (most stable first):

1. `aria-ref` label (Vimium-style — stable across class renames)
2. ARIA role + accessible name (`get_by_role`)
3. `data-testid` attribute
4. Visible text content match
5. XPath (precise but brittle to structural changes)
6. CSS class fragment (fuzzy Levenshtein match — last resort)

Research basis: a 10-tier hierarchy from DOM accessibility tree work
(Joseph 2026) shows `get_by_role` and `data-testid` outperform XPath
for resilience. XPath is kept as a first-pass attempt for performance
(it's fast when it works) but deprioritised in the healing path.

---

## Multi-selector storage

Each step stores all selector types at record time. The replay engine
tries the highest-confidence selector first, falling back down the
hierarchy without any LLM call:

```json
{
  "xpath": "/html/body/main/nav/button[2]",
  "ariaRef": "aria-ref=e5",
  "role": "button",
  "accessibleName": "דוחות",
  "cssSelector": "nav > .reports-link",
  "fallbackText": "דוחות",
  "confidence": 0.87,
  "lastSuccess": "2026-05-24",
  "origin": "recorded"
}
```

---

## DOM hash gate

Before confidence scoring even runs, the skill fingerprints the page's
key landmark elements (headings, nav items, form labels) and compares
against the `domHash` stored at record time.

- **Hash matches** → proceed to replay with confidence zones
- **Hash differs** → skip cache entirely, go straight to LLM

This avoids wasting a replay attempt on a completely restructured page,
and prevents the selector fallback chain from silently acting on the
wrong element in a changed layout.

---

## Implementation reference

Source: Anansi self-healing scraper (`mdowis/anansi` on GitHub)

```
Success: score × 1.05 + 0.02  (cap 1.0)
Failure: score × 0.85 − 0.05  (floor 0.0)
Unused >7d: score × 0.99/day
Winner threshold for healing strategies: score ≥ 0.5
```

Storage: SQLite (Anansi) or JSON per site (this project's default,
git-diffable, upgradeable to SQLite for large deployments).
