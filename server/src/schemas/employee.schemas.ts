/**
 * Zod schemas for /api/hr/employees/* endpoints (Phase 6 PR6).
 *
 * All schemas are `.strict()` per A01.1 — reject unknown body keys to defeat
 * mass-assignment attempts that would propagate into Prisma where-clauses.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §4 + §8.5 + §18.7 row 144.
 */
import { z } from 'zod'

/** Cap daily rate at Rs 10,000/day in paise — beyond that you're fat-fingering paise-as-rupees. */
export const DAILY_RATE_MAX_PAISE = 1_000_000

/** Indian mobile / E.164-ish — 10 to 15 digits, optional leading '+'. */
const PHONE_RE = /^\+?[0-9]{10,15}$/

/** cuid id check shared by both body + params. */
const cuidString = z.string().cuid('Invalid cuid')

/** Optional ISO 8601 with timezone offset (e.g. 2026-05-18T10:00:00+05:30). */
const isoDateTimeOrNull = z.union([
  z.string().datetime({ offset: true }),
  z.null(),
])

/**
 * POST /api/hr/employees — create employee + paired STAFF Party (one tx).
 *
 * Bounds:
 *   name        — 1..120 chars trimmed
 *   phone       — optional; E.164-ish 10..15 digits
 *   designation — optional; max 80 chars trimmed
 *   dailyRatePaise — Int, 0..1_000_000 paise (= 0..Rs 10,000)
 *   userId      — optional cuid (employee may also log in as a User)
 */
export const createEmployeeSchema = z
  .object({
    name: z.string().trim().min(1, 'name is required').max(120, 'name too long'),
    phone: z.string().trim().regex(PHONE_RE, 'phone must be 10-15 digits').optional(),
    designation: z.string().trim().max(80, 'designation too long').optional(),
    dailyRatePaise: z
      .number()
      .int('dailyRatePaise must be an integer (paise)')
      .min(0, 'dailyRatePaise must be >= 0')
      .max(DAILY_RATE_MAX_PAISE, `dailyRatePaise must be <= ${DAILY_RATE_MAX_PAISE}`),
    userId: cuidString.optional(),
  })
  .strict()

/**
 * PATCH /api/hr/employees/:id — partial update. `partyId` is NEVER accepted
 * (architecture §8.5 invariant — paired-Party link is immutable). `leftAt`
 * accepts ISO string or null to clear.
 */
export const updateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().regex(PHONE_RE, 'phone must be 10-15 digits').optional(),
    designation: z.string().trim().max(80).optional(),
    dailyRatePaise: z
      .number()
      .int()
      .min(0)
      .max(DAILY_RATE_MAX_PAISE)
      .optional(),
    userId: cuidString.optional(),
    leftAt: isoDateTimeOrNull.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'at least one field is required')

/** params { id: cuid } for routes that take an id path-param. */
export const employeeIdParamSchema = z
  .object({ id: cuidString })
  .strict()

/**
 * GET /api/hr/employees?q=&isDeleted=&limit=&cursor= — list (cursor-paginated).
 *
 * q          — optional name substring (1..120 trimmed)
 * isDeleted  — optional boolean, default false (hide soft-deleted rows)
 * limit      — 1..100, default 20
 * cursor     — optional opaque cursor (Employee.id from previous page)
 */
export const listEmployeesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    isDeleted: z
      .union([z.literal('true'), z.literal('false'), z.boolean()])
      .transform((v) => (v === true || v === 'true'))
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: cuidString.optional(),
  })
  .strict()

export type CreateEmployeeBody = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeSchema>
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>
