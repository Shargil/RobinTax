# Apple Reminders cohorts — osascript playbook

How to actually create, update, and complete the macOS Apple Reminders that back the journey-ledger `Reminder ID` column. Substrate choice + rules live in [ADR-012](../../../docs/decisions/ADR-012-apple-reminders-for-pending-docs.md); this file is the how.

## When to use this

Read before any code path in `get-doc` that flips a doc into or out of `requested` status. The SKILL.md "Pending-doc reminders" section is the spec; this is the executable detail.

## Hard rules

1. **Always announce, never silently.** One short user-facing line for every reminder action — create, cohort-join, title-rewrite, complete. The user must know an Apple Reminder is being created on their behalf, including the human date and the docs in the cohort. See [ADR-012](../../../docs/decisions/ADR-012-apple-reminders-for-pending-docs.md) §Why.
2. **Cohort by ETA.** Before creating a new reminder, scan the ledger for an existing `requested` row whose `ETA` matches and reuse its `Reminder ID`. Only create when no cohort exists for that date.
3. **Date format.** Use the macOS-locale-safe long form: `"Sunday, June 14, 2026 10:00:00 AM"`. Numeric `"YYYY-MM-DD"` is parsed inconsistently by AppleScript across locales.
4. **Time of day = 10:00 local.** Single uniform pick. Avoids per-doc tuning, late-evening surprises, etc.

## Snippets

### Compute ETA (Israeli business days)

`ETA = today + 2 business days`, skipping Fri+Sat. Workdays Sun (weekday 0) – Thu (weekday 4).

| Today (IL weekday) | ETA |
|---|---|
| Sun | Tue |
| Mon | Wed |
| Tue | Thu |
| Wed | Sun (next) |
| Thu | Mon (next) |
| Fri | Tue (next) |
| Sat | Tue (next) |

One-liner (date math via `date` is brittle for skip-rules; compute in your head from the table above for v1, or in a small shell loop):

```bash
# Walk forward day-by-day, count only Sun–Thu, stop at 2.
d=$(date -v+1d +%Y-%m-%d); count=0
while [ $count -lt 2 ]; do
  dow=$(date -j -f %Y-%m-%d "$d" +%u)  # 1=Mon..7=Sun
  case "$dow" in 5|6) ;; *) count=$((count+1));; esac  # 5=Fri,6=Sat skip
  [ $count -lt 2 ] && d=$(date -j -v+1d -f %Y-%m-%d "$d" +%Y-%m-%d)
done; echo "$d"
```

Format the result as `"Sunday, June 14, 2026 10:00:00 AM"` for AppleScript.

### Create a reminder (returns id)

```bash
osascript <<'OSA'
tell application "Reminders"
  set newRem to make new reminder with properties ¬
    {name:"RobinTax: בדוק אם <Hebrew name> הגיע — הפעל /robintax", ¬
     remind me date:date "Sunday, June 14, 2026 10:00:00 AM"}
  return id of newRem
end tell
OSA
```

stdout = the `Reminder ID`. Capture it and write into the ledger row.

### Update title (cohort grew or shrank)

```bash
osascript <<'OSA'
tell application "Reminders"
  set theRem to first reminder whose id is "<id>"
  set name of theRem to "RobinTax: בדוק אם 3 מסמכים הגיעו — <doc1>, <doc2>, <doc3> — הפעל /robintax"
end tell
OSA
```

### Mark completed (last doc in cohort resolved)

```bash
osascript -e 'tell application "Reminders" to set completed of (first reminder whose id is "<id>") to true'
```

### Read completion state (used by robintax AUTO-RECHECK)

```bash
osascript -e 'tell application "Reminders" to return completed of (first reminder whose id is "<id>")'
```

Returns `true` / `false` on stdout. If the user manually checked the reminder off, that's a signal to auto-recheck the cohort even if ETA is in the future.

## Title format

- 1 doc: `RobinTax: בדוק אם <Hebrew name> הגיע — הפעל /robintax`
- N≥2: `RobinTax: בדוק אם <N> מסמכים הגיעו — <doc1>, <doc2>, ... — הפעל /robintax`

Hebrew names from the doc playbook header, not slugs.

## Announce templates

- New reminder: `Setting an Apple Reminder for Sun 2026-06-14 10:00 — I'll ping you to re-check אישור תושב.`
- Joining a cohort: `Adding אישור תושב to the existing Apple Reminder for Sun 2026-06-14 10:00 (now: 3 docs).`
- Title rewrite after one resolves: `Apple Reminder for Sun 2026-06-14 updated — אישור תושב resolved, 2 docs still pending.`
- Cohort fully resolved: `Apple Reminder for Sun 2026-06-14 completed — all 3 docs resolved.`

## Verified working

- 2026-06-10 — round-trip test: created a 60-second test reminder via the create snippet above; macOS notification fired at the scheduled time. Confirms Apple Reminders + iCloud sync are live in Yam's environment. Re-verify if a new user reports no notifications.
