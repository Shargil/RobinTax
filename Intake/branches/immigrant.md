# Immigrant (§35 oleh chadash / toshav chozer)

**Profile key:** `immigrant`
**Status:** v1 — gate question is live; required doc (`immigrant-certificate`) playbook not yet written, so a `Yes` answer surfaces a manual step until the playbook exists.

## Gate
**Question:** "Did you make Aliyah or return as a returning resident (תושב חוזר ותיק) in the last 4 years?"
**Options:** Yes | No | I don't know
**Open follow-ups on:** Yes, I don't know

## Follow-ups
- **Key:** `aliyah_year` — "Which year?" — free-text (YYYY). Reason: the §35 schedule pays 3 points in year 1, 2 in year 2, 1 in year 3 (pro-rated by months); no aliyah year, no points.
- **Key:** `aliyah_type` — "Aliyah or returning-resident?" Options: `New immigrant (עולה חדש)` | `Returning resident — long absence (תושב חוזר ותיק)` | `Returning resident — short absence` | `I don't know`. Reason: returning-resident rules diverge for §35; the calculator treats them differently.

## Seeds

- **Docs (when Yes or unknown):** `immigrant-certificate` (תעודת עולה issued by משרד הקליטה). **Playbook not yet written** — intake records the requirement; `/get-doc` will need a new playbook in [`Collector/documents/immigrant-certificate.md`](../../Collector/documents/) before it can fulfill. Until then, surface a manual instruction: "Find your תעודת עולה (a small blue/white booklet) and put a scan in `~/Downloads/RobinTax/`."
- **Calculator rule keys fed:** `immigrant_points` (consumes `aliyah_year`).
