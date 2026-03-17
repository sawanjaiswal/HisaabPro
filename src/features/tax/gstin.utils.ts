/**
 * GSTIN Validation & Supply Type — Pure Functions
 * Client-side format check. Use tax.service.ts for govt API verification.
 */

/** Validate GSTIN format (15-char regex + state code range) */
export function validateGstin(gstin: string): {
  valid: boolean
  stateCode: string | null
  error?: string
} {
  if (!gstin || gstin.length !== 15) {
    return { valid: false, stateCode: null, error: 'GSTIN must be 15 characters' }
  }
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  if (!regex.test(gstin)) {
    return { valid: false, stateCode: null, error: 'Invalid GSTIN format' }
  }
  const stateCode = gstin.substring(0, 2)
  const stateNum = parseInt(stateCode, 10)
  if (stateNum < 1 || stateNum > 38) {
    return { valid: false, stateCode: null, error: 'Invalid state code in GSTIN' }
  }
  return { valid: true, stateCode }
}

/** Extract 2-digit state code from GSTIN */
export function extractStateCode(gstin: string | null): string | null {
  if (!gstin || gstin.length < 2) return null
  return gstin.substring(0, 2)
}

/**
 * Determine supply type for GSTR-1 categorization.
 * B2B: party has GSTIN | B2C_LARGE: no GSTIN + inter-state + > Rs 2.5L | B2C_SMALL: rest
 */
export function determineSupplyType(
  partyGstin: string | null,
  interState: boolean,
  grandTotalPaise: number,
): 'B2B' | 'B2C_LARGE' | 'B2C_SMALL' {
  if (partyGstin) return 'B2B'
  if (interState && grandTotalPaise > 25_000_000) return 'B2C_LARGE'
  return 'B2C_SMALL'
}

/** Format basis points as percentage string: 1800 → "18%", 25 → "0.25%" */
export function formatGstRate(basisPoints: number): string {
  const pct = basisPoints / 100
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(2)}%`
}
