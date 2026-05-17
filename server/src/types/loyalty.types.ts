/**
 * Loyalty #125 — TypeScript interfaces and DTOs.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §2.1-§2.2
 *
 * All amounts in PAISE (integer). All rates in BASIS POINTS.
 * Points are unitless integers (computed via BigInt cross-mult — see loyalty.utils.ts).
 */

import type { LoyaltyProgram, LoyaltyLedger } from '@prisma/client'
import type { LoyaltyLedgerType } from '../services/loyalty/loyalty.constants.js'

// ─── Re-export Prisma row types ─────────────────────────────────────────────
export type { LoyaltyProgram, LoyaltyLedger }

// ─── Service context (extracted from authenticated request) ────────────────
export interface LoyaltyServiceCtx {
  businessId: string
  userId: string
}

// ─── Program DTOs ───────────────────────────────────────────────────────────

export interface LoyaltyProgramInput {
  enabled: boolean
  accrualRateBps: number
  accrualMinSpendPaise: number
  redemptionUnit: number
  redemptionPaisePerUnit: number
  expiryMonths: number | null
}

// ─── Balance DTOs ───────────────────────────────────────────────────────────

export interface LoyaltyBalanceSnapshot {
  partyId: string
  pointsTotal: number          // SUM(delta) — net unexpired balance
  pointsLifetime: number       // SUM(delta) WHERE type='AC' — gross earned
  expiringSoonPoints: number   // SUM(delta) WHERE expiresAt < now+30d AND type='AC' (unredeemed)
  asOf: string                 // ISO timestamp
}

// ─── Ledger DTOs ────────────────────────────────────────────────────────────

export interface LoyaltyLedgerRow {
  id: string
  type: LoyaltyLedgerType
  delta: number
  posSaleId: string | null
  documentId: string | null
  expiryRunId: string | null
  adjustedBy: string | null
  note: string | null
  earnedAt: string             // ISO
  expiresAt: string | null     // ISO
  createdAt: string            // ISO
}

export interface LoyaltyLedgerPage {
  rows: LoyaltyLedgerRow[]
  nextCursor: string | null
}

// ─── Accrual / redemption write inputs (internal — service-layer only) ────

export interface AccrueForPosSaleInput {
  businessId: string
  partyId: string              // never the walk-in sentinel
  posSaleId: string
  subtotalPaise: number        // line subtotal AFTER discount, BEFORE tax
  earnedAt?: Date              // defaults to now
}

export interface RedemptionRequestInput {
  businessId: string
  partyId: string
  posSaleId: string
  pointsToRedeem: number       // must satisfy program math constraint
  amountPaise: number          // BigInt-validated mirror of pointsToRedeem
}

// ─── Query DTOs ─────────────────────────────────────────────────────────────

export interface LedgerQueryParams {
  partyId: string
  cursor?: string
  limit?: number
}

// ─── Computed-helper return types ──────────────────────────────────────────

export interface PointsEarnedComputation {
  subtotalPaise: number
  earnBps: number
  pointsEarned: number         // result of computePointsEarned()
  skippedReason?: 'BELOW_MIN_SPEND' | 'WALK_IN_PARTY' | 'PROGRAM_DISABLED'
}
