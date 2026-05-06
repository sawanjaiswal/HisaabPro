/**
 * Types for FEFO batch claim service — BAT-02
 */

/** One claim segment from a FEFO batch selection pass. */
export interface BatchClaim {
  batchId: string
  expiryDate: Date | null
  qtyTaken: number
  /** Batch costPrice in paise (BigInt); null when batch has no cost set. */
  costPriceAtClaim: bigint | null
}

/** Raw batch row returned by the FEFO SELECT FOR UPDATE SKIP LOCKED query. */
export interface BatchCandidateRow {
  id: string
  currentStock: number
  expiryDate: Date | null
  costPrice: number | null
}

/** Confirmed update row from the atomic per-row UPDATE RETURNING. */
export interface BatchUpdateRow {
  id: string
  currentStock: number
}
