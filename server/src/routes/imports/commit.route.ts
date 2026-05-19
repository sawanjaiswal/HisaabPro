/**
 * POST /api/imports/:id/commit — moves a PREVIEWED job → COMMITTED.
 *
 * Wire format:
 *   Headers:
 *     Authorization: Bearer <accessToken>
 *     X-Client-Version: 7.1.0+
 *     X-Idempotency-Key: <uuid>   ← REQUIRED, part of M3 four-field bind
 *   Body:
 *     { commitToken: string }     ← issued by parse at PREVIEWED
 *
 * The actual commit pipeline (advisory lock, FOR UPDATE row, bind assert,
 * chunked party insert, audit) lives in commit.service.ts. This route
 * only validates inputs, threads the idempotency key, and lifts errors
 * back onto the response envelope.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §6.1
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M3
 */

import { Router, type Request, type Response } from 'express'
import { auth } from '../../middleware/auth.js'
import { requireActiveBusiness } from '../../middleware/require-active-business.js'
import { requireOwner } from '../../middleware/permission.js'
import { requireFeature } from '../../middleware/require-feature.js'
import { requireMinClientVersion } from '../../middleware/require-min-client-version.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { prisma } from '../../lib/prisma.js'
import { sendError, sendSuccess } from '../../lib/response.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { getAuth } from '../../lib/auth-helper.js'
import { IMPORT_MIN_CLIENT_VERSION } from '../../constants/import.constants.js'
import { commitBodySchema } from '../../schemas/import.zod.js'
import { commitImportJob } from '../../services/import/commit.service.js'

export const commitImportRoute = Router({ mergeParams: true })

commitImportRoute.post(
  '/:id/commit',
  auth,
  requireActiveBusiness,
  requireOwner(),
  requireFeature('DATA_IMPORT'),
  requireMinClientVersion(IMPORT_MIN_CLIENT_VERSION),
  idempotencyCheck(),
  asyncHandler(async (req: Request, res: Response) => {
    const idempotencyKey = req.header('X-Idempotency-Key')
    if (!idempotencyKey || idempotencyKey.length === 0) {
      sendError(
        res,
        'X-Idempotency-Key header is required for commit',
        ErrorCode.VALIDATION_ERROR,
        400,
      )
      return
    }

    const parsed = commitBodySchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(
        res,
        parsed.error.issues.map((i) => i.message).join(', '),
        ErrorCode.VALIDATION_ERROR,
        400,
      )
      return
    }

    const jobId = String(req.params.id ?? '')
    if (!jobId) {
      sendError(res, 'Job id missing in path', ErrorCode.VALIDATION_ERROR, 400)
      return
    }

    const auth_ = getAuth(req)
    try {
      const result = await commitImportJob({
        jobId,
        auth: auth_,
        commitToken: parsed.data.commitToken,
        idempotencyKey,
        prisma,
        dedupResolutions: parsed.data.dedupResolutions,
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
