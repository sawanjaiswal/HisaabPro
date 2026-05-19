/**
 * Phase 7 — Import Engine · Upload service (API.5)
 *
 * Creates the `ImportJob` row at status=UPLOADED. The route already ran
 * pre-scans (XXE / zip-bomb) and sanitised the filename (M2) before
 * handing the buffer here.
 *
 * Concerns owned by this file:
 *   - active-job cap (1 active per business)
 *   - re-upload detection by (businessId, userId, fileSha256) — S5
 *     uploader-scoped so user A cannot collide with user B's recent file
 *   - SHA-256 hashing
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md §5 (upload tx + active-job check)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M1 (auth helper) / S5 / M2
 */

// PII: logger calls MUST NOT include raw cell content — only jobId,
// businessId, userId. fileName + fileSha256 are job-level metadata,
// not row content (S9).
import crypto from 'node:crypto'
import { AppError, ErrorCode } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import { emitUploaded } from './audit-emit.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type {
  AuthContext,
  ImportFormat,
  ImportJobView,
} from '../../types/import.types.js'

const ACTIVE_STATUSES = ['UPLOADED', 'PARSING', 'PREVIEWED'] as const
const REUPLOAD_EXCLUDED_STATUSES = ['EXPIRED', 'CANCELLED'] as const
const STAGED_EXPIRY_DAYS = 7

export interface CreateImportJobArgs {
  buffer: Buffer
  fileName: string
  fileSize: number
  format: ImportFormat
  entity: 'parties' | 'product'
  auth: AuthContext
  /** Optional column mapping for GENERIC_CSV — stored on the job row. */
  columnMapping?: Record<string, string> | null
  clientVersion?: string
  prisma: ExtendedPrismaClient
}

export interface CreateImportJobResult {
  job: ImportJobView
  /** True when an in-flight job with the same sha already exists for this user. */
  existing: boolean
  previousJobId?: string
}

/** Compute the SHA-256 of the uploaded buffer. Pure, no I/O. */
export function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function expiresAt(): Date {
  const now = Date.now()
  return new Date(now + STAGED_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
}

function toView(j: {
  id: string
  status: string
  format: string
  fileName: string | null
  rowCount: number
  errorCount: number
  commitToken: string | null
  createdAt: Date
  updatedAt: Date
}): ImportJobView {
  const view: ImportJobView = {
    id: j.id,
    status: j.status as ImportJobView['status'],
    format: j.format as ImportFormat,
    fileName: j.fileName,
    rowCount: j.rowCount,
    errorCount: j.errorCount,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  }
  if (j.commitToken) view.commitToken = j.commitToken
  return view
}

/**
 * Create a new ImportJob. Throws `ACTIVE_JOB_EXISTS` (409) when the
 * business already has one in-flight. Returns `existing: true` when the
 * SAME user re-uploaded a file with identical bytes within the retention
 * window — caller (route) can redirect to the previous job's preview.
 */
export async function createImportJob(
  args: CreateImportJobArgs,
): Promise<CreateImportJobResult> {
  const {
    buffer,
    fileName,
    fileSize,
    format,
    entity,
    auth,
    columnMapping,
    clientVersion,
    prisma,
  } = args

  const fileSha256 = sha256(buffer)

  // 1) Re-upload detection — scoped to the SAME uploader within this
  // business (S5). If a non-terminal job exists with the same sha, send
  // the client back to it instead of creating a duplicate.
  const previous = await prisma.importJob.findFirst({
    where: {
      businessId: auth.businessId,
      userId: auth.userId,
      fileSha256,
      status: { notIn: [...REUPLOAD_EXCLUDED_STATUSES] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      format: true,
      fileName: true,
      rowCount: true,
      errorCount: true,
      commitToken: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (previous) {
    logger.info('import.upload.reupload_detected', {
      businessId: auth.businessId,
      userId: auth.userId,
      jobId: previous.id,
    })
    return {
      job: toView(previous),
      existing: true,
      previousJobId: previous.id,
    }
  }

  // 2) Active-job check — exactly one of UPLOADED|PARSING|PREVIEWED per
  // business. We DO include COMMITTING in the architecture check, but in
  // practice COMMITTING holds the advisory lock so a second commit can
  // never run; this guard exists for the upload entry point.
  const active = await prisma.importJob.findFirst({
    where: {
      businessId: auth.businessId,
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { id: true },
  })
  if (active) {
    throw new AppError(
      ErrorCode.ACTIVE_JOB_EXISTS,
      409,
      'Another import is already in progress for this business',
      { activeJobId: active.id },
    )
  }

  // 3) Create the row at UPLOADED + emit audit inside a single tx so
  //    the job + import_job.uploaded log land atomically.
  //    status transitions to PARSING when parse.service.ts picks it up.
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.importJob.create({
      data: {
        businessId: auth.businessId,
        userId: auth.userId,
        entity,
        format,
        status: 'UPLOADED',
        fileName,
        fileSha256,
        fileSize,
        columnMapping: columnMapping ?? undefined,
        clientVersion: clientVersion ?? null,
        expiresAt: expiresAt(),
      },
      select: {
        id: true,
        status: true,
        format: true,
        fileName: true,
        rowCount: true,
        errorCount: true,
        commitToken: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    await emitUploaded(tx, auth, {
      jobId: created.id,
      format,
      fileName,
      fileSha256,
      fileSize,
    })
    return created
  })

  logger.info('import.upload.created', {
    businessId: auth.businessId,
    userId: auth.userId,
    jobId: job.id,
    format,
    fileSize,
  })

  return { job: toView(job), existing: false }
}
