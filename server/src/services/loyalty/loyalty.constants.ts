/**
 * Loyalty #125 — Ledger entry-type constants + program defaults.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §2.2 (ledger row),
 * §2.1 (program defaults), §3.1 (accrual rules).
 *
 * All amounts in PAISE (integer). All rates in BASIS POINTS (1bp = 0.01%).
 * Points are unitless integers — computed via BigInt cross-mult.
 *
 * 6 ledger entry types form 3 conjugate pairs:
 *   AC ↔ EX   (accrued ↔ expired)
 *   RD ↔ AD   (redeemed ↔ adjusted-by-staff)
 *   VD ↔ VR   (void ↔ void-restore)  ← PosSale void / restore lifecycle
 *
 * Conservation invariant: at any time the SUM(delta) over a (businessId,
 * partyId) tuple equals the unexpired balance — never goes negative.
 */

// ─── Ledger entry types ─────────────────────────────────────────────────────

export const LOYALTY_LEDGER_TYPES = ['AC', 'RD', 'EX', 'AD', 'VD', 'VR'] as const

export type LoyaltyLedgerType = (typeof LOYALTY_LEDGER_TYPES)[number]

/**
 * Human-readable label per ledger type — used in audit timelines and
 * ledger CSV exports (§3.3). NOT user-facing strings (translations live
 * in `src/lib/translations.*.ext39.ts`).
 */
export const LOYALTY_LEDGER_TYPE_LABEL: Record<LoyaltyLedgerType, string> = {
  AC: 'Accrued',
  RD: 'Redeemed',
  EX: 'Expired',
  AD: 'Adjusted',
  VD: 'Void',
  VR: 'Void Restore',
}

/**
 * Sign expectation per ledger type. Service-layer validators MUST refuse
 * an insert whose delta sign disagrees with this map — protects against
 * a bug where, e.g., an "AC" row is inserted with a negative delta and
 * silently drains the balance.
 *
 * `0` = no sign constraint (AD adjustment can go either way).
 */
export const LOYALTY_LEDGER_TYPE_SIGN: Record<LoyaltyLedgerType, -1 | 0 | 1> = {
  AC: 1,   // accrual adds points
  RD: -1,  // redemption removes points
  EX: -1,  // expiry removes points
  AD: 0,   // staff adjustment — either sign
  VD: -1,  // PosSale void → claw back the AC that was paired with it
  VR: 1,   // void undone → restore the points VD took away
}

// ─── Program defaults (matched to schema.prisma defaults) ──────────────────

/** 100 bps = 1.00 % accrual rate — generous default for retail SMBs */
export const DEFAULT_ACCRUAL_RATE_BPS = 100

/** Minimum spend (in paise) before any accrual fires — 0 = always-on */
export const DEFAULT_ACCRUAL_MIN_SPEND_PAISE = 0

/** Points must be redeemed in multiples of this unit (1 = no rounding) */
export const DEFAULT_REDEMPTION_UNIT = 1

/** 100 paise per redeemed point = Rs 1 / point — round-number default */
export const DEFAULT_REDEMPTION_PAISE_PER_UNIT = 100

/** Default expiry policy — `null` = no expiry. Must be 1-60 when set (§2.1). */
export const DEFAULT_EXPIRY_MONTHS: number | null = null

// ─── Validation bounds (consumed by Zod + service guards) ──────────────────

/** Architecture §2.1: accrualRateBps in [0, 10000] — 0% to 100% accrual */
export const ACCRUAL_RATE_MIN_BPS = 0
export const ACCRUAL_RATE_MAX_BPS = 10000

/** Architecture §2.1: expiryMonths in [1, 60] when set */
export const EXPIRY_MONTHS_MIN = 1
export const EXPIRY_MONTHS_MAX = 60

/** Pagination — ledger list page size cap (architecture §3.3) */
export const LEDGER_PAGE_SIZE_DEFAULT = 50
export const LEDGER_PAGE_SIZE_MAX = 200

/** Note column hard cap — matches schema.prisma `note VARCHAR(200)` */
export const LEDGER_NOTE_MAX_LEN = 200

/** Walk-in party sentinel — accrual MUST skip when partyId equals this (§3.1) */
export const WALK_IN_PARTY_SENTINEL = 'walkin'

/**
 * "Expiring soon" lookahead — used by balance snapshot to compute
 * `expiringSoonPoints` (§3.2). 30 days matches the in-app banner copy.
 */
export const EXPIRING_SOON_LOOKAHEAD_DAYS = 30
