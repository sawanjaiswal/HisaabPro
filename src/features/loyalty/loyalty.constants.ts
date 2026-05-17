/**
 * Loyalty #125 — Frontend constants.
 *
 * Mirrors `server/src/services/loyalty/loyalty.constants.ts`. Bounds duplicated
 * here so we can validate on the client before round-tripping; the server is
 * still the authority.
 */

import type { LoyaltyLedgerType } from './loyalty.types'

// ─── Defaults (matched to schema.prisma + server) ──────────────────────────

/** 100 bps = 1.00 % accrual — generous default for retail SMBs */
export const DEFAULT_ACCRUAL_RATE_BPS = 100

/** Minimum spend (paise) before accrual fires — 0 = always-on */
export const DEFAULT_ACCRUAL_MIN_SPEND_PAISE = 0

/** Points redeemed in multiples of this unit (1 = no rounding) */
export const DEFAULT_REDEMPTION_UNIT = 1

/** Paise per point on redemption — 100 = ₹1/point */
export const DEFAULT_REDEMPTION_PAISE_PER_UNIT = 100

/** Default expiry — null = never. Must be 1-60 months when set. */
export const DEFAULT_EXPIRY_MONTHS: number | null = null

// ─── Validation bounds (mirror loyalty-program.service.ts zod) ─────────────

export const ACCRUAL_RATE_MIN_BPS = 0
export const ACCRUAL_RATE_MAX_BPS = 10000

export const EXPIRY_MONTHS_MIN = 1
export const EXPIRY_MONTHS_MAX = 60

// ─── Pagination + UI knobs ─────────────────────────────────────────────────

export const LEDGER_PAGE_SIZE_DEFAULT = 50
export const LEDGER_PAGE_SIZE_MAX = 200

/** "Expiring soon" window — matches server EXPIRING_SOON_LOOKAHEAD_DAYS */
export const EXPIRING_SOON_DAYS = 30

// ─── Translation key + icon name per ledger type ───────────────────────────

/** i18n keys (loyaltyType{Ac,Rd,Ex,Ad,Vd,Vr}) — populated in ext41 */
export const LOYALTY_LEDGER_TYPE_LABEL_KEY: Record<LoyaltyLedgerType, string> = {
  AC: 'loyaltyTypeAc',
  RD: 'loyaltyTypeRd',
  EX: 'loyaltyTypeEx',
  AD: 'loyaltyTypeAd',
  VD: 'loyaltyTypeVd',
  VR: 'loyaltyTypeVr',
}

/** lucide-react icon name per ledger type — kept as string to avoid bundling */
export const LOYALTY_LEDGER_TYPE_ICON: Record<LoyaltyLedgerType, string> = {
  AC: 'Plus',
  RD: 'Minus',
  EX: 'Clock',
  AD: 'Edit3',
  VD: 'XCircle',
  VR: 'RotateCcw',
}

/** Color token per ledger type — semantic CSS vars (no hex) */
export const LOYALTY_LEDGER_TYPE_TONE: Record<LoyaltyLedgerType, 'positive' | 'negative' | 'neutral'> = {
  AC: 'positive',
  RD: 'negative',
  EX: 'negative',
  AD: 'neutral',
  VD: 'negative',
  VR: 'positive',
}
