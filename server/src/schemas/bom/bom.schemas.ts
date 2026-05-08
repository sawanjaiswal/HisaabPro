import { z } from 'zod'

const bomComponentSchema = z.object({
  componentProductId: z.string().min(1),
  quantity: z
    .number()
    .positive('Quantity must be greater than 0')
    .multipleOf(0.000001, 'Max 6 decimal places'),
  unitId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export const createBomSchema = z
  .object({
    productId: z.string().min(1, 'productId is required'),
    name: z.string().min(1, 'Recipe name is required').max(100),
    isDefault: z.boolean().optional().default(false),
    notes: z.string().max(2000).optional(),
    components: z
      .array(bomComponentSchema)
      .min(1, 'Add at least one component')
      .max(50, 'Maximum 50 components per BOM'),
  })
  .strict()

export const updateBomSchema = z
  .object({
    productId: z.string().min(1).optional(),
    name: z.string().min(1).max(100).optional(),
    isDefault: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
    components: z
      .array(bomComponentSchema)
      .min(1, 'Add at least one component')
      .max(50)
      .optional(),
  })
  .strict()

export const listBomQuerySchema = z
  .object({
    productId: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict()

export type CreateBomInput = z.infer<typeof createBomSchema>
export type UpdateBomInput = z.infer<typeof updateBomSchema>
export type ListBomQuery = z.infer<typeof listBomQuerySchema>
