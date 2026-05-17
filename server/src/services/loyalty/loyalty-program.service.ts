/**
 * Loyalty #125 — Program CRUD service.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §2.1 (LoyaltyProgram
 * shape), §6.1 (loyalty.configure perm), §10 (analytics).
 *
 * Tenant-singleton: at most one LoyaltyProgram per businessId.
 * - GET → nullable (caller decides empty-state UI)
 * - PUT → upsert; analyticsEmit('loyalty_program_enabled') once.
 *
 * Security:
 *   - Zod .strict() on the input schema (no extra keys from client)
 *   - Numeric caps via .min/.max — accrualRateBps ∈ [0, 10000] (S2)
 *   - expiryMonths ∈ [1, 60] when set
 */

import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { analyticsEmit } from '../../lib/analytics.js'
import {
  ACCRUAL_RATE_MIN_BPS,
  ACCRUAL_RATE_MAX_BPS,
  EXPIRY_MONTHS_MIN,
  EXPIRY_MONTHS_MAX,
} from './loyalty.constants.js'

// ─── Input schema ───────────────────────────────────────────────────────────

export const loyaltyProgramUpsertSchema = z
  .object({
    enabled: z.boolean(),
    accrualRateBps: z
      .number()
      .int()
      .min(ACCRUAL_RATE_MIN_BPS, 'accrualRateBps must be ≥ 0')
      .max(ACCRUAL_RATE_MAX_BPS, 'accrualRateBps must be ≤ 10000'),
    accrualMinSpendPaise: z.number().int().min(0),
    redemptionUnit: z.number().int().min(1),
    redemptionPaisePerUnit: z.number().int().min(0),
    expiryMonths: z
      .number()
      .int()
      .min(EXPIRY_MONTHS_MIN)
      .max(EXPIRY_MONTHS_MAX)
      .nullable()
      .optional(),
  })
  .strict()

export type LoyaltyProgramUpsertInput = z.infer<typeof loyaltyProgramUpsertSchema>

// ─── DTO ────────────────────────────────────────────────────────────────────

export interface LoyaltyProgramDTO {
  id: string
  businessId: string
  enabled: boolean
  accrualRateBps: number
  accrualMinSpendPaise: number
  redemptionUnit: number
  redemptionPaisePerUnit: number
  expiryMonths: number | null
  createdAt: Date
  updatedAt: Date
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function getProgram(businessId: string): Promise<LoyaltyProgramDTO | null> {
  const row = await prisma.loyaltyProgram.findUnique({
    where: { businessId },
    select: {
      id: true,
      businessId: true,
      enabled: true,
      accrualRateBps: true,
      accrualMinSpendPaise: true,
      redemptionUnit: true,
      redemptionPaisePerUnit: true,
      expiryMonths: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return row ?? null
}

// ─── Upsert ─────────────────────────────────────────────────────────────────

export async function upsertProgram(
  businessId: string,
  userId: string,
  input: LoyaltyProgramUpsertInput
): Promise<LoyaltyProgramDTO> {
  const existing = await prisma.loyaltyProgram.findUnique({
    where: { businessId },
    select: { id: true, enabled: true },
  })

  const wasEnabled = existing?.enabled ?? false

  const row = await prisma.loyaltyProgram.upsert({
    where: { businessId },
    create: {
      businessId,
      enabled: input.enabled,
      accrualRateBps: input.accrualRateBps,
      accrualMinSpendPaise: input.accrualMinSpendPaise,
      redemptionUnit: input.redemptionUnit,
      redemptionPaisePerUnit: input.redemptionPaisePerUnit,
      expiryMonths: input.expiryMonths ?? null,
      createdBy: userId,
    },
    update: {
      enabled: input.enabled,
      accrualRateBps: input.accrualRateBps,
      accrualMinSpendPaise: input.accrualMinSpendPaise,
      redemptionUnit: input.redemptionUnit,
      redemptionPaisePerUnit: input.redemptionPaisePerUnit,
      expiryMonths: input.expiryMonths ?? null,
    },
    select: {
      id: true,
      businessId: true,
      enabled: true,
      accrualRateBps: true,
      accrualMinSpendPaise: true,
      redemptionUnit: true,
      redemptionPaisePerUnit: true,
      expiryMonths: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  // Architecture §10 — emit ONLY on transitions to enabled (first-time or re-enable).
  // POST-commit (we are outside any external tx here; upsert ran in autocommit).
  if (input.enabled && !wasEnabled) {
    analyticsEmit('loyalty_program_enabled', {
      businessId,
      accrualRateBps: input.accrualRateBps,
      expiryMonths: input.expiryMonths ?? null,
    })
  }

  return row
}
