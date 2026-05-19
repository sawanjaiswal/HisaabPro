/**
 * commit.helpers.ts — 7.1B introspection probes
 *
 * Covers:
 *  - `hasCreatedEntityIdColumn(tx)` true-path (post-Migration B1) and
 *    cache memoisation (one query for repeated calls).
 *  - `assertOpeningBalanceEnum()` happy-path when the StockMovement.type
 *    column is plain text (current shadow / dev / prod shape) AND when
 *    the enum exists with the label.
 *  - `assertOpeningBalanceEnum()` throws IMPORT_PRECONDITION_MISSING when
 *    the column is non-text AND the enum lacks OPENING_BALANCE.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorCode } from '../../../lib/errors.js'

// Mock root prisma BEFORE importing the helpers — module-level singletons
// in commit.helpers.ts must see the mock to reset cache between tests.
const queryRawMock = vi.fn()

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    get $queryRaw() {
      return queryRawMock
    },
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let helpers: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AppErrorRef: any

beforeEach(async () => {
  vi.resetModules()
  helpers = await import('../commit.helpers.js')
  ;({ AppError: AppErrorRef } = await import('../../../lib/errors.js'))
  queryRawMock.mockReset()
})

describe('hasCreatedEntityIdColumn (M8)', () => {
  it('returns true when information_schema reports the column', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [{ exists: 1 }]),
    }
    const has = await helpers.hasCreatedEntityIdColumn(tx)
    expect(has).toBe(true)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('memoises — subsequent calls do not re-query the DB', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [{ exists: 1 }]),
    }
    await helpers.hasCreatedEntityIdColumn(tx)
    await helpers.hasCreatedEntityIdColumn(tx)
    await helpers.hasCreatedEntityIdColumn(tx)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('returns false when the column is missing (pre-B1 env)', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
    }
    const has = await helpers.hasCreatedEntityIdColumn(tx)
    expect(has).toBe(false)
  })
})

describe('assertOpeningBalanceEnum (M9)', () => {
  it('passes when StockMovement.type is plain text (no enum exists)', async () => {
    queryRawMock
      .mockResolvedValueOnce([{ has_label: false }]) // pg_enum probe
      .mockResolvedValueOnce([{ data_type: 'text' }]) // column type probe
    await expect(helpers.assertOpeningBalanceEnum()).resolves.toBeUndefined()
  })

  it('passes when pg_enum has the OPENING_BALANCE label', async () => {
    queryRawMock.mockResolvedValueOnce([{ has_label: true }])
    await expect(helpers.assertOpeningBalanceEnum()).resolves.toBeUndefined()
    // Second probe must NOT fire when first answers yes.
    expect(queryRawMock).toHaveBeenCalledTimes(1)
  })

  it('throws 503 IMPORT_PRECONDITION_MISSING when neither path is satisfied', async () => {
    queryRawMock
      .mockResolvedValueOnce([{ has_label: false }])
      .mockResolvedValueOnce([{ data_type: 'USER-DEFINED' }]) // enum-typed column
    try {
      await helpers.assertOpeningBalanceEnum()
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(AppErrorRef)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((err as any).code).toBe(ErrorCode.IMPORT_PRECONDITION_MISSING)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((err as any).statusCode).toBe(503)
    }
  })

  it('memoises — happy-path result is cached for the process lifetime', async () => {
    queryRawMock.mockResolvedValueOnce([{ has_label: true }])
    await helpers.assertOpeningBalanceEnum()
    await helpers.assertOpeningBalanceEnum()
    await helpers.assertOpeningBalanceEnum()
    expect(queryRawMock).toHaveBeenCalledTimes(1)
  })
})
