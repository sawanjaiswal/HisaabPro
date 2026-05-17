/**
 * Loyalty #125 — Service-layer error factories.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.6 (error taxonomy).
 *
 * Each factory wraps the shared `AppError` from `server/src/lib/errors.ts`
 * with a Loyalty-specific code + statusCode + safe message. Service code
 * throws these directly; the global `errorHandler` middleware serializes
 * them to `{ success: false, error: { code, message, details? } }`.
 *
 * NOTE: `PARTY_NOT_FOUND` (NEW_S1) is the shared code from errors.ts —
 * Loyalty + Commission + CRM all reuse it for cross-tenant 404 responses.
 * `PARTY_NOT_IN_TENANT` (NEW_S2) is loyalty-specific to the POS payment-
 * validator path (per Security audit M-NEW_S2).
 */

import { AppError, ErrorCode } from '../../lib/errors.js'

// ─── 400 — bad input / business-rule violation ─────────────────────────────

/**
 * 400 LOYALTY_PROGRAM_DISABLED — caller tried to accrue/redeem while the
 * tenant's `LoyaltyProgram.enabled = false`.
 */
export function loyaltyDisabledError(): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    'Loyalty program is disabled for this business',
    { reason: 'LOYALTY_PROGRAM_DISABLED' }
  )
}

/**
 * 400 LOYALTY_REDEMPTION_INVALID — redemption math doesn't match program
 * (points not a multiple of redemptionUnit, or amountPaise mirror mismatch).
 */
export function loyaltyRedemptionInvalidError(detail: string): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    `Loyalty redemption invalid: ${detail}`,
    { reason: 'LOYALTY_REDEMPTION_INVALID' }
  )
}

/**
 * 400 LOYALTY_INSUFFICIENT_BALANCE — partyId's net unexpired balance is
 * less than the requested redemption.
 */
export function loyaltyInsufficientBalanceError(available: number, requested: number): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    `Insufficient loyalty balance — have ${available}, asked ${requested}`,
    { reason: 'LOYALTY_INSUFFICIENT_BALANCE', available, requested }
  )
}

/**
 * 400 LOYALTY_BELOW_MIN_SPEND — caller forced an accrual on a sale whose
 * subtotal is below `LoyaltyProgram.accrualMinSpendPaise`. Service-layer
 * skips silently when this fires; this error is for explicit /accrue API.
 */
export function loyaltyBelowMinSpendError(subtotalPaise: number, minSpendPaise: number): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    'Subtotal below minimum spend for accrual',
    { reason: 'LOYALTY_BELOW_MIN_SPEND', subtotalPaise, minSpendPaise }
  )
}

/**
 * 400 LOYALTY_WALK_IN_NOT_ALLOWED — caller tried to accrue/redeem against
 * the walk-in party sentinel. Walk-ins have no identity → no ledger.
 */
export function loyaltyWalkInNotAllowedError(): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    'Loyalty operations not allowed on walk-in parties',
    { reason: 'LOYALTY_WALK_IN_NOT_ALLOWED' }
  )
}

/**
 * 400 PARTY_NOT_IN_TENANT — POS payment-validator detected a redemption
 * payload whose partyId belongs to a different business. We surface this
 * BEFORE the idempotency token is consumed (security audit M-NEW_S2).
 */
export function partyNotInTenantError(partyId: string): AppError {
  return new AppError(
    ErrorCode.PARTY_NOT_IN_TENANT,
    400,
    'Party does not belong to this tenant',
    { partyId }
  )
}

// ─── 404 — addressed resource missing ──────────────────────────────────────

/**
 * 404 PARTY_NOT_FOUND — shared code from `errors.ts`. Loyalty uses it for
 * `GET /loyalty/balance/:partyId` and `GET /loyalty/ledger/:partyId` when
 * the partyId either doesn't exist or belongs to a different tenant
 * (cross-tenant probe protection — security audit NEW_S1).
 */
export function loyaltyPartyNotFoundError(partyId: string): AppError {
  return new AppError(ErrorCode.PARTY_NOT_FOUND, 404, 'Party not found', { partyId })
}

/**
 * 404 LOYALTY_PROGRAM_NOT_FOUND — tenant has never enabled a loyalty
 * program. Differs from "disabled" — disabled keeps history, missing
 * means no LoyaltyProgram row exists.
 */
export function loyaltyProgramNotFoundError(): AppError {
  return new AppError(
    ErrorCode.NOT_FOUND,
    404,
    'No loyalty program configured for this business'
  )
}

// ─── 409 — conflict ────────────────────────────────────────────────────────

/**
 * 409 LOYALTY_ALREADY_ACCRUED — service hit a duplicate accrual row for the
 * same posSaleId. Protects against retry-storm double-credit.
 */
export function loyaltyAlreadyAccruedError(posSaleId: string): AppError {
  return new AppError(
    ErrorCode.DUPLICATE_ENTRY,
    409,
    'Loyalty already accrued for this sale',
    { reason: 'LOYALTY_ALREADY_ACCRUED', posSaleId }
  )
}
