/**
 * Jobs Router — 8 endpoints
 * Mount point: /api/jobs (registered in app.ts after documentRoutes)
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import {
  createJobSchema,
  updateJobSchema,
  transitionJobSchema,
  listJobsSchema,
} from '../schemas/job.schemas.js'
import type { TransitionJobInput } from '../schemas/job.schemas.js'
import { type JobStatus } from '@prisma/client'
import * as jobService from '../services/job.service.js'

const router = Router()

// Auth required for all job routes
router.use(auth)

/** GET /api/jobs/recycle — List soft-deleted jobs */
router.get(
  '/recycle',
  requirePermission('jobs.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await jobService.listDeletedJobs(businessId)
    sendSuccess(res, result)
  })
)

/** GET /api/jobs — List jobs */
router.get(
  '/',
  requirePermission('jobs.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listJobsSchema.parse(req.query)
    const result = await jobService.listJobs(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/jobs/:id — Get job detail */
router.get(
  '/:id',
  requirePermission('jobs.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const job = await jobService.getJob(businessId, String(req.params.id))
    sendSuccess(res, job)
  })
)

/** POST /api/jobs — Create job */
router.post(
  '/',
  requirePermission('jobs.create'),
  validate(createJobSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const job = await jobService.createJob(businessId, req.user!.userId, req.body)
    sendSuccess(res, job, 201)
  })
)

/** PATCH /api/jobs/:id — Update job */
router.patch(
  '/:id',
  requirePermission('jobs.edit'),
  validate(updateJobSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const job = await jobService.updateJob(
      businessId, String(req.params.id), req.user!.userId, req.body
    )
    sendSuccess(res, job)
  })
)

/** POST /api/jobs/:id/transition — Transition job status */
router.post(
  '/:id/transition',
  requirePermission('jobs.edit'),
  validate(transitionJobSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const body = req.body as TransitionJobInput
    const job = await jobService.transitionJob(
      businessId,
      String(req.params.id),
      req.user!.userId,
      body.toStatus as JobStatus,
      body.reason
    )
    sendSuccess(res, job)
  })
)

/** POST /api/jobs/:id/convert-to-invoice — Convert completed job to SALE_INVOICE */
router.post(
  '/:id/convert-to-invoice',
  requirePermission('jobs.edit'),
  requirePermission('invoicing.create'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const invoice = await jobService.convertJobToInvoice(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, invoice, 201)
  })
)

/** DELETE /api/jobs/:id — Soft delete job */
router.delete(
  '/:id',
  requirePermission('jobs.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await jobService.softDeleteJob(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, result)
  })
)

/** POST /api/jobs/:id/restore — Restore from recycle bin */
router.post(
  '/:id/restore',
  requirePermission('jobs.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await jobService.restoreJob(businessId, String(req.params.id))
    sendSuccess(res, result)
  })
)

/** DELETE /api/jobs/:id/permanent — Permanently delete from recycle bin */
router.delete(
  '/:id/permanent',
  requirePermission('jobs.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await jobService.permanentDeleteJob(businessId, String(req.params.id))
    sendSuccess(res, result)
  })
)

export default router
