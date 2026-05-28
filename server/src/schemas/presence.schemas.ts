// #150 Presence request schemas. `.strict()` everywhere — reject unknown keys so
// a client can't smuggle businessId/userName (those come from the token / server).
import { z } from 'zod'

export const presenceEntityTypeSchema = z.enum(['party', 'product', 'document', 'payment'])

export const heartbeatSchema = z
  .object({
    entityType: presenceEntityTypeSchema,
    entityId: z.string().min(10).max(40),
    mode: z.enum(['viewing', 'editing']),
  })
  .strict()

export type HeartbeatInput = z.infer<typeof heartbeatSchema>
