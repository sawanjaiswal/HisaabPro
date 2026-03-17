/**
 * GSTIN Validation & Utility Functions — Pure
 * No Prisma, no Express. String validation only.
 */

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Mod-36 Luhn variant checksum for GSTIN */
function gstinChecksum(gstin14: string): string {
  const weights = [1, 3]
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const val = GSTIN_CHARSET.indexOf(gstin14[i])
    const product = val * weights[i % 2]
    sum += Math.floor(product / 36) + (product % 36)
  }
  const checkDigit = (36 - (sum % 36)) % 36
  return GSTIN_CHARSET[checkDigit]
}

/**
 * Validate GSTIN format (15 characters with checksum).
 * Format: 2-digit state + 10-char PAN + 1-digit entity + Z + checksum
 */
export function validateGstin(gstin: string): { valid: boolean; stateCode: string | null; error?: string } {
  const upper = gstin.toUpperCase().trim()
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  if (!regex.test(upper)) {
    return { valid: false, stateCode: null, error: 'Invalid GSTIN format' }
  }
  const expectedCheck = gstinChecksum(upper.slice(0, 14))
  if (upper[14] !== expectedCheck) {
    return { valid: false, stateCode: null, error: 'Invalid GSTIN checksum' }
  }
  return { valid: true, stateCode: upper.slice(0, 2) }
}

/** Extract state code from GSTIN (first 2 characters). */
export function extractStateCode(gstin: string): string | null {
  if (!gstin || gstin.length < 2) return null
  return gstin.slice(0, 2).toUpperCase()
}

/** B2C_LARGE threshold: Rs 2,50,000 = 25000000 paise */
const B2C_LARGE_THRESHOLD_PAISE = 25_000_000

/**
 * Determine GSTR supply type.
 * B2B: party has GSTIN | B2C_LARGE: no GSTIN + total > Rs 2.5L | B2C_SMALL: rest
 */
export function determineSupplyType(
  partyGstin: string | null,
  grandTotalPaise: number,
): 'B2B' | 'B2C_LARGE' | 'B2C_SMALL' {
  if (partyGstin && partyGstin.trim().length > 0) return 'B2B'
  if (grandTotalPaise > B2C_LARGE_THRESHOLD_PAISE) return 'B2C_LARGE'
  return 'B2C_SMALL'
}
