/**
 * GSTR-1 Reconciliation Zod Schemas
 */

import { z } from 'zod'

// ─── Constants ────────────────────────────────────────────────────────────────

const RECON_TYPES = ['GSTR1_VS_BOOKS', 'GSTR2A_VS_BOOKS', 'GSTR2B_VS_BOOKS'] as const
const RECON_STATUSES = ['DRAFT', 'IN_PROGRESS', 'COMPLETED'] as const
const MATCH_STATUSES = ['MATCHED', 'MISMATCHED', 'MISSING_IN_GSTR', 'EXTRA_IN_GSTR'] as const

// ─── GSTR Portal Entry (uploaded by user from government portal) ──────────────

export const gstrPortalEntrySchema = z.object({
  invoiceNumber: z.string().min(1).max(50),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invoiceDate must be YYYY-MM-DD'),
  gstin: z.string().min(15).max(15),
  partyName: z.string().max(200).optional(),
  // Rupees (float) from portal — converted to paise in service
  taxableValue: z.number().min(0),
  taxAmount: z.number().min(0),
})

export type GstrPortalEntry = z.infer<typeof gstrPortalEntrySchema>

// ─── Start Reconciliation ─────────────────────────────────────────────────────

export const startReconciliationSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  reconType: z.enum(RECON_TYPES),
  gstrData: z.array(gstrPortalEntrySchema).min(1, 'At least one GSTR entry required'),
})

export type StartReconciliationInput = z.infer<typeof startReconciliationSchema>

// ─── List Reconciliations ─────────────────────────────────────────────────────

export const listReconciliationsSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.enum(RECON_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type ListReconciliationsQuery = z.infer<typeof listReconciliationsSchema>

// ─── Reconciliation Entry Filter ──────────────────────────────────────────────

export const reconciliationEntryFilterSchema = z.object({
  matchStatus: z.enum(MATCH_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type ReconciliationEntryFilter = z.infer<typeof reconciliationEntryFilterSchema>

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ReconType = typeof RECON_TYPES[number]
export type ReconStatus = typeof RECON_STATUSES[number]
export type MatchStatus = typeof MATCH_STATUSES[number]
