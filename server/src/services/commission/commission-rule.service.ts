/**
 * Commission #128 — Rule CRUD service.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §2.3 (rule shape),
 * §4.5 (specificity), §6.1 (commission.configure perm), §10 (analytics).
 *
 * Tenant-scoped — every read/write filters by `businessId`. The Zod
 * schema (`commissionRuleInputSchema`) has already enforced rate caps
 * (S2), mode/scope cross-field guards, and `.strict()` before this
 * service runs.
 *
 *  - createRule  → insert + analyticsEmit('commission_rule_created') post-call
 *  - updateRule  → patch by id; 404 if rule does not belong to caller
 *  - deleteRule  → soft via isActive=false (Q15: keep history intact)
 *  - listRules   → ordered by specificity rank desc, then createdAt desc
 *  - getRule     → single by id
 *
 * createRule emits AFTER successful insert (autocommit; not part of any
 * outer $transaction) — architecture §3.8 side-effect rule.
 */

import { prisma } from '../../lib/prisma.js'
import { analyticsEmit } from '../../lib/analytics.js'
import { commissionRuleNotFoundError } from './commission.errors.js'
import {
  COMMISSION_RULE_SCOPE_RANK,
  type CommissionAppliesTo,
  type CommissionRuleMode,
  type CommissionRuleScope,
} from './commission.constants.js'

// ─── DTO ────────────────────────────────────────────────────────────────────

export interface CommissionRuleDTO {
  id: string
  businessId: string
  name: string
  scope: CommissionRuleScope
  scopeId: string | null
  mode: CommissionRuleMode
  rateBps: number | null
  flatPerUnitPaise: number | null
  appliesTo: CommissionAppliesTo
  staffUserIds: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

const SELECT = {
  id: true,
  businessId: true,
  name: true,
  scope: true,
  scopeId: true,
  mode: true,
  rateBps: true,
  flatPerUnitPaise: true,
  appliesTo: true,
  staffUserIds: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
} as const

// ─── Input ─────────────────────────────────────────────────────────────────

export interface CommissionRuleCreateInput {
  name: string
  scope: CommissionRuleScope
  scopeId?: string | null
  mode: CommissionRuleMode
  rateBps?: number | null
  flatPerUnitPaise?: number | null
  appliesTo: CommissionAppliesTo
  staffUserIds: string[]
  isActive: boolean
}

export type CommissionRuleUpdateInput = Partial<CommissionRuleCreateInput>

// ─── Service ───────────────────────────────────────────────────────────────

export async function createRule(
  businessId: string,
  userId: string,
  input: CommissionRuleCreateInput
): Promise<CommissionRuleDTO> {
  const row = await prisma.commissionRule.create({
    data: {
      businessId,
      name: input.name,
      scope: input.scope,
      scopeId: input.scopeId ?? null,
      mode: input.mode,
      rateBps: input.rateBps ?? null,
      flatPerUnitPaise: input.flatPerUnitPaise ?? null,
      appliesTo: input.appliesTo,
      staffUserIds: input.staffUserIds,
      isActive: input.isActive,
      createdBy: userId,
    },
    select: SELECT,
  })

  // Architecture §10 — emit AFTER autocommit. createRule runs in autocommit
  // (no outer $transaction), so emitting here cannot be rolled back.
  analyticsEmit('commission_rule_created', {
    businessId,
    ruleId: row.id,
    scope: row.scope,
    mode: row.mode,
    rateBps: row.rateBps,
    flatPerUnitPaise: row.flatPerUnitPaise,
  })

  return mapDTO(row)
}

export async function updateRule(
  businessId: string,
  ruleId: string,
  input: CommissionRuleUpdateInput
): Promise<CommissionRuleDTO> {
  // Tenant-scoped: updateMany + count guard, otherwise we leak existence to
  // cross-tenant callers via the P2025 (record not found) error.
  const existing = await prisma.commissionRule.findFirst({
    where: { id: ruleId, businessId },
    select: { id: true },
  })
  if (!existing) throw commissionRuleNotFoundError(ruleId)

  const row = await prisma.commissionRule.update({
    where: { id: ruleId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.scope !== undefined && { scope: input.scope }),
      ...(input.scopeId !== undefined && { scopeId: input.scopeId ?? null }),
      ...(input.mode !== undefined && { mode: input.mode }),
      ...(input.rateBps !== undefined && { rateBps: input.rateBps ?? null }),
      ...(input.flatPerUnitPaise !== undefined && {
        flatPerUnitPaise: input.flatPerUnitPaise ?? null,
      }),
      ...(input.appliesTo !== undefined && { appliesTo: input.appliesTo }),
      ...(input.staffUserIds !== undefined && { staffUserIds: input.staffUserIds }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: SELECT,
  })

  return mapDTO(row)
}

export async function deleteRule(businessId: string, ruleId: string): Promise<void> {
  const existing = await prisma.commissionRule.findFirst({
    where: { id: ruleId, businessId },
    select: { id: true },
  })
  if (!existing) throw commissionRuleNotFoundError(ruleId)

  // Soft delete (Locked Decision Q15) — preserve ruleId on existing ledger rows.
  await prisma.commissionRule.update({
    where: { id: ruleId },
    data: { isActive: false },
  })
}

export async function getRule(
  businessId: string,
  ruleId: string
): Promise<CommissionRuleDTO> {
  const row = await prisma.commissionRule.findFirst({
    where: { id: ruleId, businessId },
    select: SELECT,
  })
  if (!row) throw commissionRuleNotFoundError(ruleId)
  return mapDTO(row)
}

export async function listRules(
  businessId: string,
  options: { includeInactive?: boolean } = {}
): Promise<CommissionRuleDTO[]> {
  const rows = await prisma.commissionRule.findMany({
    where: {
      businessId,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    select: SELECT,
    // SQL ordering as first-pass sort; specificity-rank sort below collates
    // the in-process tie-break (architecture §4.5).
    orderBy: [{ createdAt: 'desc' }],
  })

  return rows
    .map(mapDTO)
    .sort((a, b) => {
      const ra = COMMISSION_RULE_SCOPE_RANK[a.scope]
      const rb = COMMISSION_RULE_SCOPE_RANK[b.scope]
      if (ra !== rb) return rb - ra
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
}

// ─── Mapping ───────────────────────────────────────────────────────────────

function mapDTO(row: {
  id: string
  businessId: string
  name: string
  scope: string
  scopeId: string | null
  mode: string
  rateBps: number | null
  flatPerUnitPaise: number | null
  appliesTo: string
  staffUserIds: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
}): CommissionRuleDTO {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    scope: row.scope as CommissionRuleScope,
    scopeId: row.scopeId,
    mode: row.mode as CommissionRuleMode,
    rateBps: row.rateBps,
    flatPerUnitPaise: row.flatPerUnitPaise,
    appliesTo: row.appliesTo as CommissionAppliesTo,
    staffUserIds: row.staffUserIds,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
  }
}
