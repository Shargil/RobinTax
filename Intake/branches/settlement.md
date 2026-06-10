# Settlement (יישוב מזכה — §11 settlement-discount)

**Profile key:** `settlement`
**Status:** v1
**Order:** 4

## Gate
**Question:** "During any of the years you're filing, did you live in a periphery / development-area settlement (יישוב מזכה — e.g. Eilat, Sderot, communities in the Negev or Galilee)?"
**Options:** Yes | No | I don't know
**Open follow-ups on:** Yes, I don't know

## Follow-ups
- **Key:** `settlement_name` — "Which settlement?" — free-text. Reason: the §11 discount % depends on the specific settlement and the year; the per-year list lives in [`Calculator/rules/settlements/<year>.ts`](../../Calculator/rules/settlements/).
- **Key:** `residency_years` — "Which of your filing years did you live there full-time?" — multiSelect from declared filing years. Reason: §11 requires 12+ consecutive months of residence in the year; partial years pro-rate.

## Seeds

- **Docs (when Yes):** `residency-confirmation-section-11` (אישור תושב — issued by the local council).
- **Docs (when unknown):** `residency-confirmation-section-11` — pessimistic include. The form itself asks the council to confirm whether the address qualifies; cheaper to ask than to skip a 5–20% income discount.
- **Calculator rule keys fed:** `settlement_rule` + the per-year settlements lookup.
