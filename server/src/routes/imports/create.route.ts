/**
 * POST /api/imports — upload + (sync-or-async) parse entry point.
 *
 * Middleware order is load-bearing (S3): the active-job check MUST run
 * BEFORE multer reads the buffer. Anything that streams 10 MB of bytes
 * into RAM only to be told "you already have a job" is wasted I/O and
 * a denial-of-service amplifier.
 *
 * Sync-vs-async heuristic — we don't know `rowCount` until after parsing,
 * so we threshold on raw buffer length: <500 KB = parse synchronously
 * in this request and respond with status=PREVIEWED + commitToken;
 * >=500 KB = setImmediate(parseAndStage) and respond with status=UPLOADED
 * so the FE polls. The real cap (SYNC_PARSE_CAP rows) is enforced
 * inside parse.service.ts.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §3, §3.1, §6
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M1, M2, S3
 */

import { Router, type Request, type Response } from 'express'
import { auth } from '../../middleware/auth.js'
import { requireActiveBusiness } from '../../middleware/require-active-business.js'
import { requireOwner } from '../../middleware/permission.js'
import { requireFeature } from '../../middleware/require-feature.js'
import { requireMinClientVersion } from '../../middleware/require-min-client-version.js'
import { requireNoActiveJob } from '../../middleware/require-no-active-job.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { createRateLimiter } from '../../middleware/rate-limit/factory.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { getAuth } from '../../lib/auth-helper.js'
import {
  IMPORT_MIN_CLIENT_VERSION,
  IMPORT_RATE_UPLOAD_PER_HOUR,
} from '../../constants/import.constants.js'
import { uploadBodySchema } from '../../schemas/import.zod.js'
import { createImportJob } from '../../services/import/upload.service.js'
import { runParseAndStage } from '../../services/import/parse.service.js'
import { importUpload } from './upload.middleware.js'
import {
  sanitiseFileName,
  enforcePerEntityClientVersion,
} from './create.route.helpers.js'

const SYNC_PARSE_BUFFER_THRESHOLD = 500 * 1024 // 500 KB

const uploadRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: IMPORT_RATE_UPLOAD_PER_HOUR,
  message: `Too many import uploads (max ${IMPORT_RATE_UPLOAD_PER_HOUR}/hour)`,
  keyFn: (req: Request) =>
    `rl:imports:upload:${req.user?.userId ?? req.ip ?? 'anon'}`,
  eventName: 'import.upload.rate_limited',
})

export const createImportRoute = Router()

createImportRoute.post(
  '/',
  auth,
  requireActiveBusiness,
  requireOwner(),
  requireFeature('DATA_IMPORT'),
  requireMinClientVersion(IMPORT_MIN_CLIENT_VERSION),
  requireNoActiveJob,
  uploadRateLimit,
  importUpload.single('file'),
  idempotencyCheck(),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file
    if (!file) {
      sendError(res, 'file field is required', ErrorCode.VALIDATION_ERROR, 400)
      return
    }

    const parsedBody = uploadBodySchema.safeParse(req.body)
    if (!parsedBody.success) {
      sendError(
        res,
        parsedBody.error.issues.map((i) => i.message).join(', '),
        ErrorCode.VALIDATION_ERROR,
        400,
      )
      return
    }
    const { format, entity } = parsedBody.data

    // Phase 7 · 7.1C — per-entity min-client-version (AUDIT S2).
    const clientVersion = req.header('X-Client-Version') ?? undefined
    if (enforcePerEntityClientVersion(res, entity, clientVersion)) return

    const fileName = sanitiseFileName(file.originalname || 'upload')
    const auth_ = getAuth(req)

    let result
    try {
      result = await createImportJob({
        buffer: file.buffer,
        fileName,
        fileSize: file.size,
        format,
        entity,
        auth: auth_,
        ...(clientVersion ? { clientVersion } : {}),
        prisma,
      })
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.code, err.statusCode)
        return
      }
      throw err
    }

    // Re-upload path — return the prior job without re-parsing.
    if (result.existing) {
      sendSuccess(res, {
        job: result.job,
        existing: true,
        previousJobId: result.previousJobId,
      })
      return
    }

    // Audit row — `import_job.uploaded` with sanitised filename. We hop
    // this onto prisma directly (no service wrap) because the upload
    // service intentionally stays I/O-bounded to the upload tx.
    await prisma.auditLog
      .create({
        data: {
          businessId: auth_.businessId,
          entityType: 'ImportJob',
          entityId: result.job.id,
          userId: auth_.userId,
          action: 'CREATE',
          changes: { event: 'import_job.uploaded', fileName, format },
        },
      })
      .catch((e: unknown) => {
        logger.warn('import.upload.audit_failed', {
          jobId: result.job.id,
          err: e instanceof Error ? e.message : String(e),
        })
      })

    // Sync vs async heuristic — small files block here, large files
    // setImmediate so the response is fast and FE polls /imports/:id.
    if (file.size < SYNC_PARSE_BUFFER_THRESHOLD) {
      try {
        const stage = await runParseAndStage({
          jobId: result.job.id,
          buffer: file.buffer,
          format,
          entity,
          ...(fileName ? { fileName } : {}),
          auth: auth_,
          prisma,
        })
        sendSuccess(res, {
          job: {
            ...result.job,
            status: 'PREVIEWED' as const,
            rowCount: stage.rowCount,
            errorCount: stage.errorCount,
            commitToken: stage.commitToken,
          },
          existing: false,
        })
        return
      } catch (err) {
        logger.warn('import.parse.sync_failed', {
          jobId: result.job.id,
          err: err instanceof Error ? err.message : String(err),
        })
        // fall through — respond UPLOADED, FE will see FAILED on poll.
      }
    } else {
      setImmediate(() => {
        runParseAndStage({
          jobId: result.job.id,
          buffer: file.buffer,
          format,
          entity,
          ...(fileName ? { fileName } : {}),
          auth: auth_,
          prisma,
        }).catch((e: unknown) => {
          logger.warn('import.parse.async_failed', {
            jobId: result.job.id,
            err: e instanceof Error ? e.message : String(e),
          })
        })
      })
    }
    sendSuccess(res, { job: result.job, existing: false })
  }),
)
