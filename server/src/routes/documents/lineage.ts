/**
 * GET /api/documents/:id/lineage — returns the full DocumentConversion chain.
 */

import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { sendSuccess } from '../../lib/response.js'
import { validationError } from '../../lib/errors.js'
import { getDocumentLineage } from '../../services/document/lineage.service.js'

const router = Router()

/** Path param schema — must be a valid CUID (Prisma @id @default(cuid())) */
const lineageParamsSchema = z.object({
  id: z.string().cuid({ message: 'Document id must be a valid CUID' }),
}).strict()

/**
 * GET /api/documents/:id/lineage
 * Auth: inherited from parent documents router (auth + requireFeature('invoicing'))
 * 200 — { chain: LineageNode[], currentIndex: number }
 * 400 — invalid CUID path param
 * 401 — unauthenticated (handled by parent router middleware)
 * 404 — document not found or not in this business
 */
router.get(
  '/:id/lineage',
  asyncHandler(async (req, res) => {
    const parsed = lineageParamsSchema.safeParse(req.params)
    if (!parsed.success) {
      throw validationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const businessId = req.user!.businessId
    const result = await getDocumentLineage({
      documentId: parsed.data.id,
      businessId,
    })

    sendSuccess(res, result)
  })
)

export default router
