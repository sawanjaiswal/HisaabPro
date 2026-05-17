/**
 * Commission #128 — Per line item rule matcher.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §4.5
 *   PRODUCT > CATEGORY > ALL (specificity rank desc),
 *   tie-break: createdAt desc.
 * Architecture §2.3 — `appliesTo` ∈ {POS, INVOICE, BOTH}.
 * Architecture §2.3 — staff filter: `staffUserIds[]` empty = all staff;
 *   non-empty = only rule fires when that staff is the line-staff.
 *
 * Pure functions only — no Prisma, no I/O. Caller (commission-accrual.service.ts)
 * passes the candidate set already filtered by `isActive=true` and
 * `appliesTo` matching the document type.
 */

import type { CommissionRuleDTO } from './commission-rule.service.js'
import { COMMISSION_RULE_SCOPE_RANK, type CommissionAppliesTo } from './commission.constants.js'

/** Line abstraction — POS items + Document line items both reduce to this shape. */
export interface MatchableLine {
  productId: string
  categoryId: string | null
  quantity: number       // float (kg/ltr supported); cast to number for BigInt math
  basisPaise: number     // PERCENT_GROSS = lineSubtotal pre-discount; PERCENT_NET = post-discount pre-tax
}

/**
 * Source channel — passed by caller to filter rules by `appliesTo`.
 *  - 'POS'      → POS sales
 *  - 'INVOICE'  → SALE_INVOICE saved
 * Rules with `appliesTo: 'BOTH'` match either channel.
 */
export type CommissionSource = 'POS' | 'INVOICE'

/**
 * Returns rules that apply to the given channel for a given staff.
 *
 *  - `appliesTo: 'BOTH'` matches every channel.
 *  - `staffUserIds: []` (empty) matches every staff.
 *  - `staffUserIds: ['user_x']` matches only when `staffUserId === 'user_x'`.
 *  - `isActive: false` rules are filtered upstream (rule-service `listRules`
 *    default), but we double-check here so a stale list cannot leak.
 */
export function filterApplicableRules(
  rules: CommissionRuleDTO[],
  channel: CommissionSource,
  staffUserId: string
): CommissionRuleDTO[] {
  return rules.filter(r => {
    if (!r.isActive) return false
    if (!matchesChannel(r.appliesTo, channel)) return false
    if (r.staffUserIds.length > 0 && !r.staffUserIds.includes(staffUserId)) return false
    return true
  })
}

function matchesChannel(appliesTo: CommissionAppliesTo, channel: CommissionSource): boolean {
  if (appliesTo === 'BOTH') return true
  return appliesTo === channel
}

/**
 * Pick THE rule for a given line per architecture §4.5:
 *   1. PRODUCT-scoped rule whose scopeId === lineItem.productId
 *   2. CATEGORY-scoped rule whose scopeId === product.categoryId (when set)
 *   3. ALL-scoped rule (scope='ALL', scopeId is null)
 *
 * Within the same specificity, newest `createdAt` wins.
 *
 * Returns `null` when no rule matches (line earns zero commission — no
 * ledger row is written for that line, per architecture §4.1).
 *
 * Caller MUST have already passed the `rules` array through
 * `filterApplicableRules()` so `appliesTo` + staff filtering is done.
 */
export function pickRuleForLine(
  rules: CommissionRuleDTO[],
  line: MatchableLine
): CommissionRuleDTO | null {
  let winner: CommissionRuleDTO | null = null
  let winnerRank = 0

  for (const r of rules) {
    if (!matchesScope(r, line)) continue
    const rank = COMMISSION_RULE_SCOPE_RANK[r.scope]
    if (rank > winnerRank) {
      winner = r
      winnerRank = rank
    } else if (rank === winnerRank && winner !== null) {
      // Tie-break: most-recently-defined rule wins.
      if (r.createdAt.getTime() > winner.createdAt.getTime()) winner = r
    }
  }

  return winner
}

function matchesScope(rule: CommissionRuleDTO, line: MatchableLine): boolean {
  switch (rule.scope) {
    case 'PRODUCT':
      return rule.scopeId === line.productId
    case 'CATEGORY':
      return rule.scopeId !== null && rule.scopeId === line.categoryId
    case 'ALL':
      return true
  }
}

/**
 * Compute commission paise for a (rule, line) pair using BigInt
 * cross-multiplication for precision (no float drift).
 *
 *  - PERCENT_GROSS / PERCENT_NET → `floor(basisPaise * rateBps / 10000)`
 *  - FLAT_PER_UNIT               → `floor(flatPerUnitPaise * quantity)`
 *
 * Returns 0 (NOT null) when the rule/line yields zero — caller skips
 * writing the ledger row for zero-commission lines (architecture §4.1
 * — no audit value in a zero row).
 */
export function computeCommissionPaise(rule: CommissionRuleDTO, line: MatchableLine): number {
  if (rule.mode === 'FLAT_PER_UNIT') {
    if (rule.flatPerUnitPaise === null || rule.flatPerUnitPaise <= 0) return 0
    // Quantity may be fractional (e.g. 1.5 kg) — multiply then floor.
    const product = rule.flatPerUnitPaise * line.quantity
    return Math.floor(product)
  }
  // PERCENT_GROSS / PERCENT_NET
  if (rule.rateBps === null || rule.rateBps <= 0) return 0
  if (line.basisPaise <= 0) return 0
  // BigInt cross-multiply: floor(basisPaise * rateBps / 10000)
  const num = BigInt(line.basisPaise) * BigInt(rule.rateBps)
  return Number(num / BigInt(10000))
}
