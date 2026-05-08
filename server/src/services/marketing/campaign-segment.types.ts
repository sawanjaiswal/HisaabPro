/**
 * Segment Filter — shared type (PR3)
 * Used by both MarketingCampaign and ReminderRule.
 */

import { z } from 'zod'

export const segmentFilterSchema = z.object({
  tags: z.array(z.string().max(40)).max(20).optional(),
  cityContains: z.string().max(60).optional(),
  inactiveDays: z.number().int().min(0).max(3650).optional(),
  outstandingGtePaise: z.number().int().min(0).optional(),
  birthdayThisWeek: z.boolean().optional(),
  partyType: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']).optional().default('CUSTOMER'),
}).strict()

export type SegmentFilter = z.infer<typeof segmentFilterSchema>
