/**
 * Feedback routes — adapted from DudhHisaab
 * Submit feedback, get user's feedback. Admin routes deferred.
 */

import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { sendSuccess } from '../lib/response.js'
import logger from '../lib/logger.js'

const router = Router()

const submitFeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'general']),
  message: z.string().min(1).max(5000),
  rating: z.number().int().min(1).max(5).optional(),
  screenshot: z.string().max(10_000_000).optional(), // ~10MB base64
  metadata: z.record(z.unknown()).optional(),
})

/** POST /api/feedback — submit feedback (authenticated) */
router.post(
  '/',
  auth,
  validate(submitFeedbackSchema),
  asyncHandler(async (req, res) => {
    const { type, message, rating, screenshot, metadata } = req.body

    const feedback = await prisma.feedback.create({
      data: {
        userId: req.user!.userId,
        type,
        message,
        rating,
        screenshot,
        metadata: metadata ?? undefined,
      },
      select: { id: true, type: true, status: true, createdAt: true },
    })

    logger.info('Feedback submitted', { id: feedback.id, type, userId: req.user!.userId })
    sendSuccess(res, feedback, 201)
  })
)

/** GET /api/feedback/my — get current user's feedback */
router.get(
  '/my',
  auth,
  asyncHandler(async (req, res) => {
    const feedback = await prisma.feedback.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, type: true, message: true, rating: true, status: true, createdAt: true },
    })

    sendSuccess(res, feedback)
  })
)

export default router
