/**
 * EWB threshold table by state (advisory — review quarterly with NIC notifications).
 * Key: 2-digit state code string (from GSTIN prefix / pincode prefix).
 * Value: minimum invoice value in paise for mandatory EWB.
 *
 * Default inter-state threshold: Rs 50,000 (5_000_000 paise) per CGST Rule 138.
 * Maharashtra intra-state: Rs 1,00,000 — notification dated 2018-04-01.
 * All others default to Rs 50,000 intra-state where the state has notified.
 *
 * Usage: getEwbThreshold(stateCode, isInterState)
 */

// State codes: '27' = Maharashtra, '29' = Karnataka, etc.
// Advisory comments note which circular/notification applies.
const INTRA_STATE_THRESHOLDS: Record<string, number> = {
  '27': 10_000_000, // Maharashtra — Rs 1,00,000 (Notif. No. 15E/2018, dated 2018-04-01)
  '29': 5_000_000,  // Karnataka — Rs 50,000 (matches national default)
  // Remaining states default to national threshold below
}

const DEFAULT_THRESHOLD_PAISE = 5_000_000 // Rs 50,000

/**
 * Returns EWB mandatory threshold in paise.
 * Pass stateCode as the seller's state (from GSTIN prefix or pincode 2-digit).
 */
export function getEwbThreshold(stateCode: string, isInterState: boolean): number {
  if (isInterState) return DEFAULT_THRESHOLD_PAISE
  return INTRA_STATE_THRESHOLDS[stateCode] ?? DEFAULT_THRESHOLD_PAISE
}

/**
 * Determine if supply is inter-state.
 * fromState: seller state code, toState: buyer/delivery state code.
 * Both are 2-digit strings (e.g. '27', '09').
 */
export function isInterState(fromState: string, toState: string): boolean {
  return fromState !== toState
}
