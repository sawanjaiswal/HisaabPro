/**
 * Phase-5 job behaviour (Files #31-#33).
 *
 * Not in the original file plan — added because "typechecks and registers" is the
 * exact standard this epic exists to reject. A6/A7 (File #41) assert that the
 * crons are REGISTERED; nothing there asserts they compute the right thing.
 *
 * Fakes rather than a DB: every predicate under test is date arithmetic and
 * branch selection, and a real Postgres would test Prisma, not these three files.
 */
import { describe, expect, it, vi } from 'vitest'
import { runShadowRetention } from '../shadow-retention.cron.js'
import { runShadowWatchdog } from '../shadow-watchdog.cron.js'
import { runShadowCanary } from '../shadow-canary.cron.js'
import {
  SHADOW_CANARY_FOREIGN_ID,
  SHADOW_CANARY_SELF_ID,
} from '../../lib/prisma-shadow.constants.js'

const NOW = new Date('2026-07-22T00:00:00.000Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

function fakeRetentionPrisma(rows: { id: string }[]) {
  const wheres: Record<string, unknown>[] = []
  const deleted: string[][] = []
  return {
    wheres,
    deleted,
    client: {
      scopedShadowDivergence: {
        findMany: vi.fn(async (args: { where: Record<string, unknown> }) => {
          wheres.push(args.where)
          return rows
        }),
        deleteMany: vi.fn(async (args: { where: { id: { in: string[] } } }) => {
          deleted.push(args.where.id.in)
          return { count: args.where.id.in.length }
        }),
      },
      scopedShadowStat: { deleteMany: vi.fn(async () => ({ count: 3 })) },
    },
  }
}

describe('shadow-retention (#31)', () => {
  it('deletes on BOTH ceilings — lastSeenAt 30d and createdAt 180d', async () => {
    const f = fakeRetentionPrisma([{ id: 'a' }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await runShadowRetention({ prisma: f.client as any, now: NOW })

    expect(f.wheres).toHaveLength(2)
    expect(f.wheres[0]).toEqual({ lastSeenAt: { lt: daysAgo(30) } })
    // The absolute ceiling is the M-5 linkage bound — a still-firing row refreshes
    // lastSeenAt forever, so without this predicate it is retained indefinitely.
    expect(f.wheres[1]).toEqual({ createdAt: { lt: daysAgo(180) } })
    expect(res.staleDeleted).toBe(1)
    expect(res.absoluteDeleted).toBe(1)
    expect(res.statsDeleted).toBe(3)
    expect(res.capped).toBe(false)
  })

  it('is a no-op when nothing has aged out', async () => {
    const f = fakeRetentionPrisma([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await runShadowRetention({ prisma: f.client as any, now: NOW })
    expect(f.deleted).toHaveLength(0)
    expect(res.staleDeleted + res.absoluteDeleted).toBe(0)
  })
})

function fakeWatchdogPrisma(
  stats: { kind: string; count: number; hourBucket: Date }[],
  canary: { lastSeenAt: Date } | null,
) {
  return {
    scopedShadowStat: { findMany: vi.fn(async () => stats) },
    scopedShadowDivergence: { findFirst: vi.fn(async () => canary) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('shadow-watchdog (#33)', () => {
  it('stays silent when no watch is in progress', async () => {
    const res = await runShadowWatchdog({ prisma: fakeWatchdogPrisma([], null), now: NOW })
    expect(res.verdict).toBe('idle')
  })

  it('pages when the harness went silent under an active watch', async () => {
    // `watch-active` alone = boot armed it, but nothing has ever been sampled.
    const res = await runShadowWatchdog({
      prisma: fakeWatchdogPrisma([{ kind: 'watch-active', count: 1, hourBucket: NOW }], {
        lastSeenAt: NOW,
      }),
      now: NOW,
    })
    expect(res.verdict).toBe('harness-silent')
  })

  it('pages when the canary is older than 45 minutes', async () => {
    const res = await runShadowWatchdog({
      prisma: fakeWatchdogPrisma([{ kind: 'sampled', count: 40, hourBucket: NOW }], {
        lastSeenAt: new Date(NOW.getTime() - 46 * 60_000),
      }),
      now: NOW,
    })
    expect(res.verdict).toBe('canary-missing')
    expect(res.canaryAgeMs).toBeGreaterThan(45 * 60_000)
  })

  it('is quiet on the hour boundary — previous hour counts', async () => {
    const prevHour = new Date(NOW.getTime() - 3_600_000)
    const res = await runShadowWatchdog({
      prisma: fakeWatchdogPrisma([{ kind: 'sampled', count: 500, hourBucket: prevHour }], {
        lastSeenAt: NOW,
      }),
      now: NOW,
    })
    expect(res.verdict).toBe('ok')
    expect(res.sampledPrevHour).toBe(500)
  })
})

function fakeCanaryDb(ids: string[]) {
  return {
    party: { findMany: vi.fn(async () => ids.map((id) => ({ id }))) },
    scopedShadowDivergence: { upsert: vi.fn(async () => ({})) },
    scopedShadowStat: { upsert: vi.fn(async () => ({})) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('shadow-canary (#32)', () => {
  it('writes a canary row only when the foreign fixture row was filtered', async () => {
    const db = fakeCanaryDb([SHADOW_CANARY_SELF_ID])
    const res = await runShadowCanary({ db, businessId: 'canary-biz', mode: 'shadow' })
    expect(res.outcome).toBe('detected')
    expect(db.scopedShadowDivergence.upsert).toHaveBeenCalledTimes(1)
  })

  it('writes NOTHING when the read came back unfiltered — the watchdog pages', async () => {
    // This is the whole point of a positive control: an unconditional heartbeat
    // would prove node-cron fired, not that scoping still works.
    const db = fakeCanaryDb([SHADOW_CANARY_SELF_ID, SHADOW_CANARY_FOREIGN_ID])
    const res = await runShadowCanary({ db, businessId: 'canary-biz', mode: 'shadow' })
    expect(res.outcome).toBe('not-detected')
    expect(db.scopedShadowDivergence.upsert).not.toHaveBeenCalled()
  })

  it('reports a half-seeded fixture instead of passing on a length check', async () => {
    const db = fakeCanaryDb([])
    const res = await runShadowCanary({ db, businessId: 'canary-biz', mode: 'shadow' })
    expect(res.outcome).toBe('fixture-missing')
    expect(db.scopedShadowDivergence.upsert).not.toHaveBeenCalled()
  })

  it('skips when no canary business is configured', async () => {
    const db = fakeCanaryDb([SHADOW_CANARY_SELF_ID])
    const res = await runShadowCanary({ db, mode: 'shadow' })
    expect(res.outcome).toBe('skipped')
  })

  it('skips under mode off — the harness is absent, not merely quiet', async () => {
    const db = fakeCanaryDb([SHADOW_CANARY_SELF_ID])
    const res = await runShadowCanary({ db, businessId: 'canary-biz', mode: 'off' })
    expect(res.outcome).toBe('skipped')
    expect(db.party.findMany).not.toHaveBeenCalled()
  })
})
