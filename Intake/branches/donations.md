# Donations (§46 — 35% credit on recognized donations)

**Profile key:** `donation`
**Status:** v1 — gate is live; receipts doc playbook not yet written.

## Gate
**Question:** "Did you donate to a recognized non-profit (מוסד מוכר לפי סעיף 46) in any of those years? Recognized means the org's receipt has its §46 status printed on it — most major Israeli charities qualify."
**Options:** Yes | No | I don't know
**Open follow-ups on:** Yes, I don't know

## Follow-ups
- **Key:** `donation_band_per_year` — "Roughly how much per year?" Options: `Under ₪200` | `₪200–₪1,000` | `₪1,000–₪10,000` | `Over ₪10,000` | `I don't know`. Reason: the §46 credit has both a min-eligible floor and an absolute + percent-of-income cap (see [`Calculator/rules/types.ts`](../../Calculator/rules/types.ts) `DonationRule`); under the floor the credit is zero and we shouldn't waste collection effort.

## Seeds

- **Docs (when Yes, band ≥ `₪200–₪1,000`):** `donation-receipts` (קבלות סעיף 46). **Playbook not yet written** — see immigrant branch note. Surface manual instruction: "Email the orgs you donated to and ask for an annual §46 receipt; drop the PDFs in `~/Downloads/RobinTax/`."
- **Docs (when unknown):** `donation-receipts` — pessimistic include.
- **Calculator rule keys fed:** `donation`.
