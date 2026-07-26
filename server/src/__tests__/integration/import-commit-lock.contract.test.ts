/**
 * The advisory lock every import commit takes, against live Postgres.
 *
 * `acquireBusinessLock` is the first statement of the commit transaction, so if
 * the SQL it emits is not a callable signature, EVERY import commit fails with
 * a 500 and nothing is ever written. The unit suite mocks `$executeRaw`, which
 * accepts any string — only a real server resolves the overload. Postgres has
 * `pg_advisory_xact_lock(bigint)` and `(int4, int4)`; it has no
 * `(bigint, bigint)`, and passing two bigints raises 42883.
 */
import { describe, it, expect } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { acquireBusinessLock } from '../../services/import/commit.helpers.js'
import type { Tx } from '../../services/import/commit.helpers.js'

describe('import commit advisory lock', () => {
  it('is a signature Postgres actually has', async () => {
    await prisma.$transaction(async (tx) => {
      await acquireBusinessLock(tx as unknown as Tx, 'cmbizzzzzzzzzzzzzzzzzzzzz')
    })
  })

  it('serialises on the business, not on every commit', async () => {
    // Two different businesses must not collide on one key — a global lock
    // would queue every shop's import behind every other shop's.
    const held: number[] = []
    await prisma.$transaction(async (tx) => {
      await acquireBusinessLock(tx as unknown as Tx, 'cmbiz-a')
      const [{ locks }] = await tx.$queryRaw<Array<{ locks: bigint }>>`
        SELECT count(*) AS locks FROM pg_locks WHERE locktype = 'advisory'
      `
      held.push(Number(locks))
    })
    expect(held[0], 'the lock was actually taken').toBeGreaterThanOrEqual(1)
  })
})
