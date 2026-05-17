/**
 * Loyalty #125 — Frontend DTOs.
 *
 * Mirrors the server contract exactly. Server SSOT:
 *   - server/src/services/loyalty/loyalty-program.service.ts (LoyaltyProgramDTO)
 *   - server/src/services/loyalty/loyalty-balance.service.ts (LoyaltyBalanceDTO,
 *     LoyaltyLedgerRowDTO, LoyaltyLedgerPageDTO)
 *   - server/src/services/loyalty/loyalty.constants.ts (LoyaltyLedgerType)
 *
 * All amounts in PAISE (integer). All rates in BASIS POINTS (1bp = 0.01%).
 * Points are unitless integers — computed via BigInt cross-mult.
 *
 * Wire format: dates come back as ISO strings (JSON) — we keep them as `string`
 * on the wire and let consumers parse on render.
 */

// ─── Ledger entry types ─────────────────────────────────────────────────────
// Conjugate pairs:  AC↔EX (accrued↔expired) · RD↔AD (redeemed↔adjusted) ·
// VD↔VR (void↔void-restore).
export type LoyaltyLedgerType = 'AC' | 'RD' | 'EX' | 'AD' | 'VD' | 'VR'

// ─── Program ────────────────────────────────────────────────────────────────

export interface LoyaltyProgramDTO {
  id: string
  businessId: string
  enabled: boolean
  /** Accrual rate in basis points (100 bps = 1.00 %) */
  accrualRateBps: number
  /** Sale must be ≥ this paise amount before any accrual fires (0 = always-on) */
  accrualMinSpendPaise: number
  /** Redeem in multiples of this point unit (1 = no rounding) */
  redemptionUnit: number
  /** Paise value per redemption unit (100 = ₹1/point) */
  redemptionPaisePerUnit: number
  /** null = no expiry. 1-60 when set. */
  expiryMonths: number | null
  createdAt: string
  updatedAt: string
}

export interface LoyaltyProgramInput {
  enabled: boolean
  accrualRateBps: number
  accrualMinSpendPaise: number
  redemptionUnit: number
  redemptionPaisePerUnit: number
  expiryMonths: number | null
}

// ─── Balance ────────────────────────────────────────────────────────────────

export interface LoyaltyBalanceDTO {
  partyId: string
  /** Unexpired sum of delta — never negative */
  currentPoints: number
  /** SUM of positive AC entries (lifetime) */
  lifetimeEarned: number
  /** SUM of |delta| of RD entries (lifetime) */
  lifetimeRedeemed: number
  /** Points expiring in the next `expiringSoonDays` window */
  expiringSoonPoints: number
  expiringSoonDays: number
}

// ─── Ledger ─────────────────────────────────────────────────────────────────

export interface LoyaltyLedgerRowDTO {
  id: string
  type: LoyaltyLedgerType
  /** Signed delta — positive for AC/VR, negative for RD/EX/VD, either for AD */
  delta: number
  note: string | null
  posSaleId: string | null
  documentId: string | null
  /** When the points were earned (ISO string on the wire) */
  earnedAt: string
  /** When the points expire (ISO string) — null = never */
  expiresAt: string | null
  createdAt: string
}

export interface LoyaltyLedgerPageDTO {
  rows: LoyaltyLedgerRowDTO[]
  /** Cursor for the next page — null when this is the last page */
  nextCursor: string | null
}
