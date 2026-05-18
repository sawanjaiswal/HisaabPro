/**
 * Zod schemas for /api/payroll/* endpoints (Phase 6 PR6).
 *
 * All schemas are `.strict()` per A01.1 — reject unknown body keys to defeat
 * mass-assignment attempts that would propagate into Prisma where-clauses.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §6.1 + §8 + §18.7 row 145.
 */
import { z } from 'zod'

/** Date wire format — yyyy-mm-dd. Service converts to a Postgres DATE via `new Date(...)`. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** cuid id check. */
const cuidString = z.string().cuid('Invalid cuid')

/**
 * Payment.mode allowed values — mirror PAYMENT_MODES in shared/enums.ts.
 * Service-internal writes use the same union; we duplicate here to keep this
 * schema file self-contained (no cross-folder import drag).
 */
export const PAYROLL_PAYMENT_MODES = [
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'NEFT_RTGS_IMPS',
  'CREDIT_CARD',
  'OTHER',
] as const
export type PayrollPaymentMode = (typeof PAYROLL_PAYMENT_MODES)[number]

/**
 * POST /api/payroll/run/preview — dry-run preview (no writes).
 *
 *   { fromDate, toDate, employeeIds? }
 *
 * employeeIds optional — omit to preview every employee in the business.
 * Capped at 500 ids to bound the IN-list in the SELECT.
 */
export const previewPayrollSchema = z
  .object({
    fromDate: z.string().regex(DATE_RE, 'fromDate must be yyyy-mm-dd'),
    toDate: z.string().regex(DATE_RE, 'toDate must be yyyy-mm-dd'),
    employeeIds: z.array(cuidString).max(500, 'max 500 employeeIds').optional(),
  })
  .strict()
  .refine((v) => v.fromDate <= v.toDate, {
    message: 'fromDate must be on or before toDate',
    path: ['fromDate'],
  })

/**
 * POST /api/payroll/run/finalize — finalize for a period (writes Payment + Payroll
 * + PayslipSnapshot + audit in ONE tx per architecture §8.1).
 *
 * Same surface as preview, plus optional `mode` (defaults to CASH at the service).
 */
export const finalizePayrollSchema = z
  .object({
    fromDate: z.string().regex(DATE_RE, 'fromDate must be yyyy-mm-dd'),
    toDate: z.string().regex(DATE_RE, 'toDate must be yyyy-mm-dd'),
    employeeIds: z.array(cuidString).max(500, 'max 500 employeeIds').optional(),
    mode: z.enum(PAYROLL_PAYMENT_MODES).optional(),
  })
  .strict()
  .refine((v) => v.fromDate <= v.toDate, {
    message: 'fromDate must be on or before toDate',
    path: ['fromDate'],
  })

/** params { id: cuid } — PayrollRun.id for reverse / snapshot routes. */
export const payrollIdParamSchema = z
  .object({ id: cuidString })
  .strict()

/**
 * POST /api/payroll/run/:id/reverse — empty body (action is in the path).
 *
 * We `.strict()` an empty object so a stray field 400s rather than silently
 * succeeding. The route's validate(payrollIdParamSchema) handles the path id;
 * this schema gates req.body which Express parses to {} on empty POST.
 */
export const reversePayrollBodySchema = z.object({}).strict()

export type PreviewPayrollBody = z.infer<typeof previewPayrollSchema>
export type FinalizePayrollBody = z.infer<typeof finalizePayrollSchema>
export type PayrollIdParam = z.infer<typeof payrollIdParamSchema>
