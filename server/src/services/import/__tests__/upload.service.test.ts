/**
 * upload.service.ts — unit tests
 *
 * Covers:
 *  - re-upload detection within the same uploader (S5)
 *  - ACTIVE_JOB_EXISTS rejection
 *  - happy path returns existing=false
 *
 * No real Prisma; we hand-roll the minimum surface (`importJob.findFirst`,
 * `importJob.create`) used by the service.
 */

import { describe, it, expect, vi } from 'vitest'
import { createImportJob, sha256 } from '../upload.service.js'
import { AppError, ErrorCode } from '../../../lib/errors.js'

interface JobRow {
  id: string
  status: string
  format: string
  fileName: string | null
  rowCount: number
  errorCount: number
  commitToken: string | null
  createdAt: Date
  updatedAt: Date
}

function buildPrisma(opts: {
  previous?: JobRow | null
  active?: { id: string } | null
}) {
  const created: { args: unknown }[] = []
  const findFirstCalls: { args: unknown }[] = []
  const auditCreates: Array<{ data: Record<string, unknown> }> = []
  const create = vi.fn(async (args: { data: Record<string, unknown> }) => {
    created.push({ args })
    return {
      id: 'job-new',
      status: 'UPLOADED',
      format: args.data.format as string,
      fileName: args.data.fileName as string | null,
      rowCount: 0,
      errorCount: 0,
      commitToken: null,
      createdAt: new Date('2026-05-18T00:00:00Z'),
      updatedAt: new Date('2026-05-18T00:00:00Z'),
    }
  })
  const auditLog = {
    create: vi.fn(async (args: { data: Record<string, unknown> }) => {
      auditCreates.push(args)
      return { id: 'al' }
    }),
  }
  const tx = { importJob: { create }, auditLog }
  const prisma = {
    importJob: {
      findFirst: vi.fn(async (args: { where: { fileSha256?: string } }) => {
        findFirstCalls.push({ args })
        // First call is re-upload by fileSha256; second is active-job check.
        if ('fileSha256' in args.where) return opts.previous ?? null
        return opts.active ?? null
      }),
      create,
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  return { prisma, created, findFirstCalls, auditCreates }
}

const auth = { businessId: 'biz-A', userId: 'user-1' }
const baseArgs = {
  buffer: Buffer.from('Name,Phone\nRaju,9111111111'),
  fileName: 'parties.csv',
  fileSize: 30,
  format: 'GENERIC_CSV' as const,
  entity: 'parties' as const,
  auth,
}

describe('createImportJob', () => {
  it('sha256 is stable and hex', () => {
    expect(sha256(Buffer.from('abc'))).toMatch(/^[a-f0-9]{64}$/)
    expect(sha256(Buffer.from('abc'))).toBe(sha256(Buffer.from('abc')))
  })

  it('creates a new job when no previous and no active', async () => {
    const { prisma, created } = buildPrisma({})
    const result = await createImportJob({
      ...baseArgs,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.existing).toBe(false)
    expect(result.job.id).toBe('job-new')
    expect(result.job.status).toBe('UPLOADED')
    expect(created).toHaveLength(1)
    const data = created[0]!.args as { data: Record<string, unknown> }
    expect(data.data.businessId).toBe('biz-A')
    expect(data.data.userId).toBe('user-1')
    expect(typeof data.data.fileSha256).toBe('string')
  })

  it('returns existing previous job when same uploader re-uploads same bytes', async () => {
    const previous: JobRow = {
      id: 'job-prev',
      status: 'PREVIEWED',
      format: 'GENERIC_CSV',
      fileName: 'parties.csv',
      rowCount: 12,
      errorCount: 0,
      commitToken: 'token-prev-1234567890abcdef',
      createdAt: new Date('2026-05-17T00:00:00Z'),
      updatedAt: new Date('2026-05-17T00:00:00Z'),
    }
    const { prisma } = buildPrisma({ previous })
    const result = await createImportJob({
      ...baseArgs,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.existing).toBe(true)
    expect(result.previousJobId).toBe('job-prev')
    expect(result.job.commitToken).toBe('token-prev-1234567890abcdef')
    // Create must NOT have been called.
    expect(prisma.importJob.create).not.toHaveBeenCalled()
  })

  it('throws ACTIVE_JOB_EXISTS when a different in-flight job exists for the business', async () => {
    const { prisma } = buildPrisma({ active: { id: 'job-other' } })
    await expect(
      createImportJob({
        ...baseArgs,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.ACTIVE_JOB_EXISTS,
      statusCode: 409,
    })
    expect(prisma.importJob.create).not.toHaveBeenCalled()
  })

  it('re-upload check is scoped by BOTH businessId AND userId', async () => {
    const { prisma, findFirstCalls } = buildPrisma({})
    await createImportJob({
      ...baseArgs,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    // The first call is the re-upload check.
    const reuploadCall = findFirstCalls[0]!.args as {
      where: { businessId: string; userId: string; fileSha256: string }
    }
    expect(reuploadCall.where.businessId).toBe('biz-A')
    expect(reuploadCall.where.userId).toBe('user-1')
    expect(reuploadCall.where.fileSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns a proper AppError instance (not plain Error)', async () => {
    const { prisma } = buildPrisma({ active: { id: 'job-other' } })
    try {
      await createImportJob({
        ...baseArgs,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      })
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
    }
  })
})
