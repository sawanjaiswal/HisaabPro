/**
 * commit.service.ts — M3 four-field binding suite.
 *
 * Each test flips ONE of (commitToken, idempotencyKey, businessId, userId,
 * status) and verifies the assert raises 409 BAD_COMMIT_TOKEN. The error
 * message is uniform across all five paths so an attacker cannot
 * distinguish which field was wrong.
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md M3
 */

import { describe, it, expect } from 'vitest'
import { commitImportJob } from '../commit.service.js'
import { ErrorCode } from '../../../lib/errors.js'
import {
  AUTH_OK,
  VALID_IDEMP,
  VALID_TOKEN,
  buildPrisma,
} from './commit.fixtures.js'

describe('commitImportJob — M3 binding', () => {
  it('wrong commitToken → BAD_COMMIT_TOKEN (409)', async () => {
    const { prisma } = buildPrisma()
    await expect(
      commitImportJob({
        jobId: 'job-1',
        auth: AUTH_OK,
        commitToken: 'totally-different-token-value',
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.BAD_COMMIT_TOKEN,
      statusCode: 409,
    })
  })

  it('wrong idempotencyKey → BAD_COMMIT_TOKEN (409)', async () => {
    const { prisma } = buildPrisma()
    await expect(
      commitImportJob({
        jobId: 'job-1',
        auth: AUTH_OK,
        commitToken: VALID_TOKEN,
        idempotencyKey: 'different-idemp-key-99999999999',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.BAD_COMMIT_TOKEN,
      statusCode: 409,
    })
  })

  it('cross-business jobId (auth.businessId mismatch) → BAD_COMMIT_TOKEN', async () => {
    const { prisma } = buildPrisma()
    await expect(
      commitImportJob({
        jobId: 'job-1',
        auth: { businessId: 'biz-DIFFERENT', userId: 'user-1' },
        commitToken: VALID_TOKEN,
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.BAD_COMMIT_TOKEN })
  })

  it('cross-user jobId (auth.userId mismatch) → BAD_COMMIT_TOKEN', async () => {
    const { prisma } = buildPrisma()
    await expect(
      commitImportJob({
        jobId: 'job-1',
        auth: { businessId: 'biz-A', userId: 'user-OTHER' },
        commitToken: VALID_TOKEN,
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.BAD_COMMIT_TOKEN })
  })

  it('job not in PREVIEWED status → BAD_COMMIT_TOKEN', async () => {
    const { prisma } = buildPrisma({
      jobOverrides: { status: 'COMMITTED' },
    })
    await expect(
      commitImportJob({
        jobId: 'job-1',
        auth: AUTH_OK,
        commitToken: VALID_TOKEN,
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.BAD_COMMIT_TOKEN })
  })

  it('job row missing (lockJob returns null) → BAD_COMMIT_TOKEN', async () => {
    const { prisma, tx } = buildPrisma()
    tx.$queryRaw.mockImplementationOnce(async () => [])
    await expect(
      commitImportJob({
        jobId: 'nonexistent',
        auth: AUTH_OK,
        commitToken: VALID_TOKEN,
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.BAD_COMMIT_TOKEN })
  })
})
