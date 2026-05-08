import { z } from 'zod'

export const createProductionRunSchema = z
  .object({
    bomId: z.string().min(1, 'bomId is required'),
    quantityProduced: z.number().positive('Quantity must be greater than 0'),
    runDate: z.string().min(1, 'runDate is required').refine(
      s => !isNaN(Date.parse(s)),
      'runDate must be a valid ISO 8601 date'
    ),
    notes: z.string().max(2000).optional(),
  })
  .strict()

export const listProductionRunQuerySchema = z
  .object({
    bomId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    status: z.enum(['DRAFT', 'COMPLETED', 'CANCELLED']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict()

export type CreateProductionRunInput = z.infer<typeof createProductionRunSchema>
export type ListProductionRunQuery = z.infer<typeof listProductionRunQuerySchema>
