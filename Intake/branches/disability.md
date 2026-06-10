# Disability (§9(5) — disability exemption)

**Profile key:** `disability`
**Status:** v2-stub — intake skips this branch until promoted to v1.

## When promoted, ask
- **Gate:** "Do you have a recognized disability rating ≥ 40% (or ≥ 19% for partial) from ביטוח לאומי or the Ministry of Defense?"
- **Follow-up:** disability percentage band, period covered (start/end year).

## Will seed
- **Doc:** `form-169a-medical-committee` (פרוטוקול ועדה רפואית) — playbook not yet written.
- **Calculator rule keys fed:** `disability_points` + the ordinary-income exemption ceiling in the engine.

Why deferred: the calculator-side exemption logic is the most complex non-soldier branch and the proof-doc collection (ועדה רפואית) needs its own research before we can responsibly fetch it.
