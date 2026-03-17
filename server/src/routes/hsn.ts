/**
 * HSN Code Routes — search and lookup
 * All routes require auth. HSN codes are global (no businessId filter).
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { hsnSearchSchema } from '../schemas/tax.schemas.js'

const router = Router()

router.use(auth)

// ─── Search ───────────────────────────────────────────────────────────────────

/** GET /api/hsn/search?q=<term>&limit=20 — Search HSN codes by code or description */
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q, limit } = hsnSearchSchema.parse(req.query)

    // Search by code prefix first, then description contains
    const byCode = await prisma.hsnCode.findMany({
      where: { code: { startsWith: q } },
      take: limit,
      orderBy: { code: 'asc' },
      select: { code: true, description: true, defaultRate: true, cessApplicable: true, cessRate: true },
    })

    if (byCode.length >= limit) {
      sendSuccess(res, { results: byCode })
      return
    }

    // Fill remaining quota with description search (excluding already found codes)
    const foundCodes = byCode.map((h: { code: string }) => h.code)
    const remaining = limit - byCode.length

    const byDesc = await prisma.hsnCode.findMany({
      where: {
        description: { contains: q, mode: 'insensitive' },
        ...(foundCodes.length > 0 ? { code: { notIn: foundCodes } } : {}),
      },
      take: remaining,
      orderBy: { code: 'asc' },
      select: { code: true, description: true, defaultRate: true, cessApplicable: true, cessRate: true },
    })

    sendSuccess(res, { results: [...byCode, ...byDesc] })
  })
)

// ─── Get by code ──────────────────────────────────────────────────────────────

/** GET /api/hsn/:code — Get single HSN code */
router.get(
  '/:code',
  asyncHandler(async (req, res) => {
    const hsnCode = await prisma.hsnCode.findUnique({
      where: { code: String(req.params.code) },
    })
    if (!hsnCode) {
      sendSuccess(res, null, 404)
      return
    }
    sendSuccess(res, { hsnCode })
  })
)

export default router
