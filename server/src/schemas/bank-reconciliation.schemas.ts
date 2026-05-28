/**
 * #147 Bank reconciliation — Zod schemas (all `.strict()`; server-derived fields
 * — businessId, status, confidence, method — are NEVER accepted from the body).
 */
import { z } from 'zod'

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'invalid date' })

const statementRowSchema = z
  .object({
    txnDate: isoDate,
    amount: z.number().int().positive().max(1_000_000_000_00), // paise, > 0, ≤ ₹1000 crore
    direction: z.enum(['CREDIT', 'DEBIT']),
    description: z.string().max(500).nullish(),
    referenceNumber: z.string().max(100).nullish(),
  })
  .strict()

export const createImportSchema = z
  .object({
    bankAccountId: z.string().min(1).max(40),
    fileName: z.string().min(1).max(255),
    rows: z.array(statementRowSchema).min(1).max(2000),
  })
  .strict()

export const listLinesSchema = z
  .object({
    bankAccountId: z.string().min(1).max(40).optional(),
    status: z.enum(['UNMATCHED', 'SUGGESTED', 'MATCHED', 'IGNORED']).optional(),
    importId: z.string().min(1).max(40).optional(),
    cursor: z.string().min(1).max(40).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict()

export const matchLineSchema = z
  .object({
    paymentId: z.string().min(1).max(40),
  })
  .strict()

export type CreateImportInput = z.infer<typeof createImportSchema>
export type ListLinesInput = z.infer<typeof listLinesSchema>
export type MatchLineInput = z.infer<typeof matchLineSchema>
