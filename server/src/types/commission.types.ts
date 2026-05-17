/**
 * Commission #128 — TypeScript interfaces + DTOs.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §4 (data model),
 * §4.3 (rule resolution), §4.4 (leaderboard + ledger queries).
 *
 * All amounts in PAISE (integer). All rates in BASIS POINTS.
 * `meta` JSON on every ledger row carries a deep-cloned `ruleSnapshot` so
 * after-the-fact rule edits cannot rewrite historical commission rows.
 */

import type { CommissionRule, CommissionLedger } from '@prisma/client'
import type {
  CommissionAppliesTo,
  CommissionRuleMode,
  CommissionRuleScope,
} from '../services/commission/commission.constants.js'

// ─── Re-export Prisma row types ─────────────────────────────────────────────
export type { CommissionRule, CommissionLedger }

// ─── Service context (extracted from authenticated request) ────────────────
export interface CommissionServiceCtx {
  businessId: string
  userId: string
}

// ─── Rule DTOs ─────────────────────────────────────────────────────────────

/**
 * Inferred from `commissionRuleSchema`. PERCENT_GROSS / PERCENT_NET require
 * `rateBps`; FLAT_PER_UNIT requires `flatPerUnitPaise`. The Zod schema
 * enforces this discriminator — service code just sees the union.
 */
export interface CommissionRuleInput {
  name: string
  scope: CommissionRuleScope
  scopeId?: string | null            // null when scope=ALL; PRODUCT/CATEGORY require it
  mode: CommissionRuleMode
  rateBps?: number | null            // required for PERCENT_*; null for FLAT
  flatPerUnitPaise?: number | null   // required for FLAT_PER_UNIT; null otherwise
  appliesTo: CommissionAppliesTo
  staffUserIds?: string[]            // required when appliesTo=LIST; ignored when ALL
  isActive: boolean
}

// ─── Ledger DTOs ────────────────────────────────────────────────────────────

/** Snapshot of the rule at the time the commission was accrued (architecture §4.2). */
export interface CommissionRuleSnapshot {
  ruleId: string
  name: string
  scope: CommissionRuleScope
  scopeId: string | null
  mode: CommissionRuleMode
  rateBps: number | null
  flatPerUnitPaise: number | null
}

/** Shape of `CommissionLedger.meta` JSON column. */
export interface CommissionLedgerMeta {
  ruleSnapshot: CommissionRuleSnapshot
  basisLabel: 'GROSS' | 'NET' | 'UNITS'
  productId?: string
  categoryId?: string
  unitsCount?: number
}

export interface CommissionLedgerRow {
  id: string
  staffUserId: string
  ruleId: string | null
  posSaleId: string | null
  documentId: string | null
  basisPaise: number
  commissionPaise: number
  periodYearMonth: string  // YYYY-MM
  createdAt: string        // ISO
  meta: CommissionLedgerMeta | null
}

export interface CommissionLedgerPage {
  rows: CommissionLedgerRow[]
  nextCursor: string | null
}

// ─── Leaderboard DTOs ──────────────────────────────────────────────────────

export interface CommissionLeaderboardRow {
  staffUserId: string
  staffName: string                  // joined from User.name at query time
  totalBasisPaise: number
  totalCommissionPaise: number
  saleCount: number
}

export interface CommissionLeaderboardPage {
  rows: CommissionLeaderboardRow[]
  periodYearMonth: string
  totalCommissionPaise: number       // sum across rows — convenience for header tile
}

// ─── Query DTOs ────────────────────────────────────────────────────────────

export interface LedgerQueryParams {
  staffUserId?: string               // optional — staff role implicitly filters to self
  periodYearMonth: string            // YYYY-MM required
  cursor?: string
  limit?: number
}

export interface LeaderboardQueryParams {
  periodYearMonth: string            // YYYY-MM required
  limit?: number
}

// ─── Accrual-write input (internal — service-layer only) ──────────────────

export interface AccrueForPosSaleLineInput {
  businessId: string
  posSaleId: string
  documentId?: string | null
  productId: string
  categoryId?: string | null
  unitsCount: number
  grossSubtotalPaise: number          // line subtotal BEFORE discount
  netSubtotalPaise: number            // line subtotal AFTER discount, BEFORE tax
  staffUserId: string                 // the salesperson at checkout
}

/** Result of `applyCommissionRules()` — written to ledger inside the same tx. */
export interface CommissionAccrualResult {
  ruleId: string | null               // null = no rule matched (zero row not written)
  basisPaise: number
  commissionPaise: number
  ruleSnapshot: CommissionRuleSnapshot | null
}
