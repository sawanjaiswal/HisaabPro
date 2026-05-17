/**
 * Loyalty #125 — Zod input validation.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §2 + §3 + §5.1.
 *
 * All schemas use `.strict()` (Pattern B — hand-rolled allow-list) so
 * tampered server-only fields are rejected with VALIDATION_ERROR rather
 * than silently dropped. Inferred types are NOT exported — service types
 * live in `server/src/types/loyalty.types.ts`.
 */

import { z } from 'zod'
import {
  ACCRUAL_RATE_MAX_BPS,
  ACCRUAL_RATE_MIN_BPS,
  EXPIRY_MONTHS_MAX,
  EXPIRY_MONTHS_MIN,
  LEDGER_NOTE_MAX_LEN,
  LEDGER_PAGE_SIZE_DEFAULT,
  LEDGER_PAGE_SIZE_MAX,
  LOYALTY_LEDGER_TYPES,
} from '../services/loyalty/loyalty.constants.js'

// ─── Program configuration (PUT /loyalty/program) ──────────────────────────

/**
 * Body for the program upsert endpoint. Tenant identity is read from the
 * session — never accepted from the wire. `enabled=false` keeps history
 * intact but blocks future accrual/redemption.
 */
export const loyaltyProgramInputSchema = z.object({
  enabled: z.boolean(),
  accrualRateBps: z
    .number()
    .int()
    .min(ACCRUAL_RATE_MIN_BPS, 'accrualRateBps must be >= 0')
    .max(ACCRUAL_RATE_MAX_BPS, 'accrualRateBps cannot exceed 10000 (100%)'),
  accrualMinSpendPaise: z
    .number()
    .int()
    .min(0, 'accrualMinSpendPaise must be a non-negative integer (paise)'),
  redemptionUnit: z
    .number()
    .int()
    .min(1, 'redemptionUnit must be at least 1'),
  redemptionPaisePerUnit: z
    .number()
    .int()
    .min(1, 'redemptionPaisePerUnit must be at least 1'),
  expiryMonths: z
    .number()
    .int()
    .min(EXPIRY_MONTHS_MIN, `expiryMonths must be >= ${EXPIRY_MONTHS_MIN}`)
    .max(EXPIRY_MONTHS_MAX, `expiryMonths cannot exceed ${EXPIRY_MONTHS_MAX}`)
    .nullable(),
}).strict()

// ─── Redemption request (POS payment of mode `loyalty_redemption`) ─────────

/**
 * Embedded in POS payment array on `POST /pos/sales`. `amountPaise` MUST
 * mirror what the service computes from points × redemptionPaisePerUnit /
 * redemptionUnit — server recomputes and rejects mismatches.
 */
export const loyaltyRedemptionInputSchema = z.object({
  partyId: z.string().min(1, 'partyId required for loyalty redemption'),
  pointsToRedeem: z.number().int().positive('pointsToRedeem must be positive'),
  amountPaise: z.number().int().positive('amountPaise must be positive'),
}).strict()

// ─── Staff manual adjustment (POST /loyalty/ledger/:partyId/adjust) ───────

/**
 * Permits an Owner/Manager to manually post a positive or negative ledger
 * row (type='AD'). `delta=0` rejected — pointless. `note` capped at 200ch
 * to match the schema column.
 */
export const loyaltyAdjustInputSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, { message: 'delta cannot be zero' }),
  note: z
    .string()
    .min(1, 'note is required for manual adjustments')
    .max(LEDGER_NOTE_MAX_LEN, `note must be <= ${LEDGER_NOTE_MAX_LEN} characters`),
}).strict()

// ─── Ledger pagination (GET /loyalty/ledger/:partyId) ──────────────────────

export const loyaltyLedgerQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LEDGER_PAGE_SIZE_MAX, `limit must be <= ${LEDGER_PAGE_SIZE_MAX}`)
    .default(LEDGER_PAGE_SIZE_DEFAULT),
  type: z.enum(LOYALTY_LEDGER_TYPES).optional(),
}).strict()

// ─── Balance query (GET /loyalty/balance/:partyId) ─────────────────────────
// No body; path param `partyId` validated in route handler. The query has
// no inputs — re-export an empty strict schema so the route layer can
// uniformly `.parse(req.query)` without if/else.
export const loyaltyBalanceQuerySchema = z.object({}).strict()
