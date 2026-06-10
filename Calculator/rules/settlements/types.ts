// Eligible-settlement list shape (יישוב מזכה).
// One file per tax year (./2020.ts ... ./2025.ts) exports `const settlements: YearSettlements`.
// The settlement *rule* (income ceiling, etc.) lives in the parent year file; only the
// list of qualifying places + their per-settlement rates lives here.

export interface EligibleSettlement {
  /** Hebrew name as it appears in the official ITA notice. */
  name_he: string;
  /** Containing local/regional council (Hebrew). Not always populated — the ITA §11 table does not list it. */
  council_he?: string;
  /** Discount rate (0..1) — typically 0.10–0.20. */
  rate: number;
  /** Optional per-settlement income ceiling (NIS); falls back to the year's `settlement_rule.max_income_ceiling_nis` if undefined. */
  income_ceiling_nis?: number;
  /** First tax year this settlement appears in the list. */
  added_year?: number;
  /** Last tax year this settlement appears in the list, if removed. */
  removed_year?: number;
  /** Free-text reviewer note. */
  notes?: string;
}

export interface YearSettlements {
  tax_year: number;
  /** Pointer to the citation key in the parent YearRules.citations. */
  cite: string;
  settlements: EligibleSettlement[];
}
