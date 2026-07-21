/**
 * Hourly counters and the watch-window read queries (File #16, §7.2a, §8.2).
 *
 * Prisma query API only — `upsert`, `increment`, `groupBy`, `findMany`. No
 * `$queryRaw`/`$executeRaw` (M-4b). If a rollup here ever genuinely needs raw
 * SQL, the reviewed `raw-sql-audit.allowlist.json` row lands in the SAME commit
 * with a written tenant-safety note — never afterwards, and never unexplained.
 *
 * This table holds counters and no identifiers at all. That separation is the
 * point: it is what lets the divergence table stay an anomaly table with its own
 * bounds and its own retention, while healthy volume still has somewhere to go.
 */
import type { ShadowDb, ShadowStatKind } from './prisma-shadow.types.js'

export interface ShadowStats {
  /**
   * Increment one row per kind for the current hour. `routeHint` is recorded for
   * `observed-framed` only — every other kind writes '', which is what keeps the
   * table's cardinality at `hours × kinds` instead of `hours × kinds × routes`.
   */
  bump(kinds: ShadowStatKind[], routeHint?: string): Promise<void>
  /** Exit criterion 2 (§11): distinct framed routes over the watch window. */
  distinctFramedRoutes(sinceMs: number): Promise<number>
  /** Totals per kind over the window, for the status payload (§8.2). */
  countsByKind(sinceMs: number): Promise<Record<string, number>>
}

export interface ShadowStatsConfig {
  db: ShadowDb
  now?: () => number
}

interface StatRow {
  kind: string
  routeHint: string
  count: number
}

/** Floor to the hour. The bucket, not the timestamp, is half the unique key. */
export function hourBucket(ms: number): Date {
  const d = new Date(ms)
  d.setUTCMinutes(0, 0, 0)
  return d
}

export function createShadowStats(config: ShadowStatsConfig): ShadowStats {
  const { db } = config
  const now = config.now ?? (() => Date.now())

  async function bump(kinds: ShadowStatKind[], routeHint = ''): Promise<void> {
    const bucket = hourBucket(now())

    await Promise.all(
      kinds.map((kind) => {
        // Only the framed-observation counter is route-keyed. Applying the hint
        // to every kind would multiply the whole table by the route cardinality
        // for no analytical gain.
        const hint = kind === 'observed-framed' ? routeHint : ''
        return db.scopedShadowStat.upsert({
          where: { hourBucket_kind_routeHint: { hourBucket: bucket, kind, routeHint: hint } },
          create: { hourBucket: bucket, kind, routeHint: hint, count: 1 },
          update: { count: { increment: 1 } },
        })
      }),
    )
  }

  async function distinctFramedRoutes(sinceMs: number): Promise<number> {
    const rows = (await db.scopedShadowStat.findMany({
      where: {
        kind: 'observed-framed',
        routeHint: { not: '' },
        hourBucket: { gt: hourBucket(sinceMs) },
      },
      select: { routeHint: true },
      distinct: ['routeHint'],
    })) as { routeHint: string }[]

    return rows.length
  }

  async function countsByKind(sinceMs: number): Promise<Record<string, number>> {
    const rows = (await db.scopedShadowStat.findMany({
      where: { hourBucket: { gt: hourBucket(sinceMs) } },
      select: { kind: true, routeHint: true, count: true },
    })) as StatRow[]

    const totals: Record<string, number> = {}
    for (const row of rows) {
      totals[row.kind] = (totals[row.kind] ?? 0) + row.count
    }
    return totals
  }

  return { bump, distinctFramedRoutes, countsByKind }
}
