/**
 * DELETE /api/imports/:id — cancels a pre-commit job (UPLOADED |
 * PARSING | PREVIEWED → CANCELLED). 409 if the job is in a terminal
 * state or doesn't belong to this uploader.
 *
 * No idempotency middleware — cancellation is naturally idempotent at
 * the service layer (updateMany with state guard).
 */

import { Router, type Request, type Response } from 'express'
import { auth } from '../../middleware/auth.js'
import { requireActiveBusiness } from '../../middleware/require-active-business.js'
import { requireOwner } from '../../middleware/permission.js'
import { requireFeature } from '../../middleware/require-feature.js'
import { requireMinClientVersion } from '../../middleware/require-min-client-version.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { prisma } from '../../lib/prisma.js'
import { sendError, sendSuccess } from '../../lib/response.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { getAuth } from '../../lib/auth-helper.js'
import { IMPORT_MIN_CLIENT_VERSION } from '../../constants/import.constants.js'
import { cancelImportJob } from '../../services/import/cancel.service.js'

export const cancelImportRoute = Router({ mergeParams: true })

cancelImportRoute.delete(
  '/:id',
  auth,
  requireActiveBusiness,
  requireOwner(),
  requireFeature('DATA_IMPORT'),
  requireMinClientVersion(IMPORT_MIN_CLIENT_VERSION),
  asyncHandler(async (req: Request, res: Response) => {
    const jobId = String(req.params.id ?? '')
    if (!jobId) {
      sendError(res, 'Job id missing in path', ErrorCode.VALIDATION_ERROR, 400)
      return
    }
    const auth_ = getAuth(req)
    try {
      const result = await cancelImportJob({ jobId, auth: auth_, prisma })
      sendSuccess(res, result)
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.code, err.statusCode)
        return
      }
      throw err
    }
  }),
)
