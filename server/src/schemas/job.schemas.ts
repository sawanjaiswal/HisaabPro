/**
 * Job Zod Schemas — validation for all job endpoints
 */

import { z } from 'zod'

export const JOB_STATUSES = [
  'QUOTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED',
] as const

export const JOB_ITEM_KINDS = ['ITEM', 'HOURLY'] as const

const jobItemSchema = z.object({
  productId: z.string().cuid().nullable().optional(),
  // V1 hourly billing — HOURLY relabels quantity (= hours) and ratePaise (= rate/hour).
  kind: z.enum(JOB_ITEM_KINDS).optional().default('ITEM'),
  description: z.string().min(1).max(500),
  // Decimal qty: accept string or number, coerce to string for Prisma Decimal
  quantity: z.union([z.string(), z.number()]).transform(v => String(v)).pipe(
    z.string().refine(v => {
      const n = parseFloat(v)
      return !isNaN(n) && n >= 0
    }, 'Quantity must be >= 0')
  ),
  ratePaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative().optional().default(0),
}).strict()

// V1 hourly billing — estimate vs actual, tracking-only (never summed into money).
const jobHoursSchema = z.number().min(0).max(100000).nullable().optional()

export const createJobSchema = z.object({
  partyId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  estimatedHours: jobHoursSchema,
  actualHours: jobHoursSchema,
  items: z.array(jobItemSchema).min(1).max(200),
  clientId: z.string().min(1).max(64).optional(),
}).strict()

export const updateJobSchema = createJobSchema.partial().omit({ clientId: true })

export const transitionJobSchema = z.object({
  toStatus: z.enum(['QUOTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  reason: z.string().max(500).optional(),
}).strict().refine(
  data => data.toStatus !== 'CANCELLED' || (data.reason !== undefined && data.reason.length > 0),
  { message: 'reason is required when cancelling a job', path: ['reason'] }
)

export const listJobsSchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  partyId: z.string().cuid().optional(),
  q: z.string().max(120).optional(),
  scheduledFrom: z.string().datetime().optional(),
  scheduledTo: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict()

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>
export type TransitionJobInput = z.infer<typeof transitionJobSchema>
export type ListJobsQuery = z.infer<typeof listJobsSchema>
