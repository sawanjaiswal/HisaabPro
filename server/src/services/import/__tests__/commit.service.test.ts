/**
 * commit.service.ts — happy-path + retry-safety unit tests.
 *
 * M3 binding cases live in `commit.bind.test.ts` so this file stays focused
 * on the happy path + row-level guard + PARTIALLY_COMMITTED behaviour.
 */

import { describe, it, expect } from 'vitest'
import { commitImportJob } from '../commit.service.js'
import { AppError } from '../../../lib/errors.js'
import {
  AUTH_OK,
  VALID_IDEMP,
  VALID_TOKEN,
  buildPrisma,
} from './commit.fixtures.js'

describe('commitImportJob — happy path + retry safety', () => {
  it('100 rows → 100 parties + one batched audit row per chunk (S6)', async () => {
    const stagedRows = Array.from({ length: 100 }, (_, i) => ({
      id: `r${i}`,
      sourceIndex: i,
      normalized: { name: `Party ${i}`, openingBalancePaise: 0 },
      matchedPartyId: null,
    }))
    const { prisma, tx } = buildPrisma({ stagedRows })
    const result = await commitImportJob({
      jobId: 'job-1',
      auth: AUTH_OK,
      commitToken: VALID_TOKEN,
      idempotencyKey: VALID_IDEMP,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.committedCount).toBe(100)
    expect(result.partial).toBe(false)
    expect(tx.party.create).toHaveBeenCalledTimes(100)
    // 2 audit rows: parties.imported_batch (chunk) + import_job.committed (API.7).
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2)
    const calls = tx.auditLog.create.mock.calls as unknown as Array<
      [{ data: { changes: { event: string; partyIds?: string[] } } }]
    >
    const batch = calls.find((c) => c[0].data.changes.event === 'parties.imported_batch')
    expect(batch).toBeDefined()
    expect(batch![0].data.changes.partyIds).toHaveLength(100)
    const committed = calls.find((c) => c[0].data.changes.event === 'import_job.committed')
    expect(committed).toBeDefined()
  })

  it('row-level guard — updateMany count=0 leaves committedCount at 0', async () => {
    const { prisma, tx } = buildPrisma()
    tx.importJobRow.updateMany.mockResolvedValueOnce({ count: 0 })
    const result = await commitImportJob({
      jobId: 'job-1',
      auth: AUTH_OK,
      commitToken: VALID_TOKEN,
      idempotencyKey: VALID_IDEMP,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.committedCount).toBe(0)
    expect(tx.party.create).toHaveBeenCalledTimes(1)
  })

  it('PARTIALLY_COMMITTED on mid-loop failure', async () => {
    const stagedRows = Array.from({ length: 3 }, (_, i) => ({
      id: `r${i}`,
      sourceIndex: i,
      normalized: { name: `Party ${i}` },
      matchedPartyId: null,
    }))
    const { prisma } = buildPrisma({ stagedRows, failPartyCreateAt: 2 })
    await expect(
      commitImportJob({
        jobId: 'job-1',
        auth: AUTH_OK,
        commitToken: VALID_TOKEN,
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      }),
    ).rejects.toBeInstanceOf(Error)
    expect(prisma.importJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PARTIALLY_COMMITTED' }),
      }),
    )
  })

  it('AppError from bind step is NOT converted to PARTIALLY_COMMITTED', async () => {
    const { prisma } = buildPrisma()
    try {
      await commitImportJob({
        jobId: 'job-1',
        auth: AUTH_OK,
        commitToken: 'wrong',
        idempotencyKey: VALID_IDEMP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma: prisma as any,
      })
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
    }
    // PARTIALLY_COMMITTED side-effect must NOT fire for AppError.
    expect(prisma.importJob.update).not.toHaveBeenCalled()
  })
})
