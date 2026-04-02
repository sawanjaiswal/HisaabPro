import { z } from 'zod'
import { SOFT_DELETE_MODELS } from '../lib/soft-delete/models.js'

/** Valid entity types for recycle bin operations */
const entityTypes = SOFT_DELETE_MODELS.filter(
  // Exclude cascade children — they restore with parent
  (m) => !['PartyAddress', 'PartyPricing', 'OpeningBalance'].includes(m),
)

export const recycleBinQuerySchema = z.object({
  entityType: z.string().refine(
    (val) => entityTypes.includes(val as never),
    { message: `Must be one of: ${entityTypes.join(', ')}` },
  ),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const recycleBinParamsSchema = z.object({
  entityType: z.string().refine(
    (val) => entityTypes.includes(val as never),
    { message: 'Invalid entity type' },
  ),
  id: z.string().min(1),
})
