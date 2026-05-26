/**
 * GET /api/imports/:id — uploader-scoped job + paginated preview rows.
 *
 * Query params (validated by previewQuerySchema):
 *   rowStatus  STAGED | ERROR | SKIPPED   (default = all)
 *   cursor     <opaque row-id>            (last id from previous page)
 *   limit      1..200                     (default 50)
 *
 * Row payloads run through `sanitizeForPreviewJson` inside the service
 * so a value like `=cmd|'/c calc'!A0` arrives at the FE as `'=cmd...`.
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
import { previewQuerySchema } from '../../schemas/import.zod.js'
import { getImportJob } from '../../services/import/get.service.js'

export const getImportRoute = Router({ mergeParams: true })

getImportRoute.get(
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
    const parsed = previewQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(
        res,
        parsed.error.issues.map((i) => i.message).join(', '),
        ErrorCode.VALIDATION_ERROR,
        400,
      )
      return
    }
    const auth_ = getAuth(req)
    try {
      const result = await getImportJob({
        jobId,
        auth: auth_,
        prisma,
        ...(parsed.data.rowStatus ? { rowStatus: parsed.data.rowStatus } : {}),
        ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}),
        limit: parsed.data.limit,
      })
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
