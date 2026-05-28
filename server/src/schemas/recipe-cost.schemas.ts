/** Recipe Cost Dashboard — query schema. */

import { z } from 'zod'

export const recipeCostQuerySchema = z.object({
  /** Optional finished-good filter. */
  productId: z.string().min(1).optional(),
})

export type RecipeCostQuery = z.infer<typeof recipeCostQuerySchema>
