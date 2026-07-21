/**
 * File #17 — sink dedupe + hourly cap, against a fake `ShadowDb`. No real DB.
 *
 * The AA-2 regression is the reason this file exists. Under the rev-1 key
 * `[shapeHash, routeHint]`, every empty-diff record — every `no-context` from
 * every cron, every `shadow-error`, every `unsupported-shape` — hashed to the
 * same constant and upserted into ONE row. That does not merely under-report: it
 * reduces the `runUnscoped` adoption backlog query, this epic's primary
 * deliverable, to a single fabricated row naming one arbitrary model. The test
 * below fails if the key ever narrows again.
 */
import { describe, it, expect } from 'vitest'
import { createShadowSink } from '../prisma-shadow.sink.js'
import { buildNoContextRecord, buildRecord } from '../prisma-shadow.redact.js'
import { SHADOW_MAX_KEYS_PER_HOUR } from '../prisma-shadow.constants.js'
import type { ScopedShadowDivergenceRecord, ShadowDb } from '../prisma-shadow.types.js'

interface UpsertArgs {
  where: { kind_model_operation_shapeHash_routeHint: Record<string, string> }
  create: Record<string, unknown>
  update: Record<string, unknown>
}

/** Records every upsert and models the unique index the schema declares. */
function fakeDb() {
  const calls: UpsertArgs[] = []
  const rows = new Map<string, number>()

  const db: ShadowDb = {
    scopedShadowDivergence: {
      upsert: async (args: unknown) => {
        const a = args as UpsertArgs
        calls.push(a)
        const key = Object.values(a.where.kind_model_operation_shapeHash_routeHint).join(' ')
        rows.set(key, (rows.get(key) ?? 0) + 1)
        return {}
      },
      groupBy: async () => [],
      count: async () => 0,
    },
    scopedShadowStat: { upsert: async () => ({}), findMany: async () => [] },
  }

  return { db, calls, rows }
}

const ctx = (over: Partial<Parameters<typeof buildNoContextRecord>[0]> = {}) => ({
  model: 'Party',
  operation: 'findMany',
  meta: undefined,
  subjectBusinessId: null,
  observationIntervalMs: 4,
  argFlags: { hasInclude: false, hasBoundedWindow: false },
  ...over,
})

const divergence = (ids: string[]): ScopedShadowDivergenceRecord =>
  buildRecord(
    'diverged',
    {
      onlyUnscoped: ids,
      onlyScoped: [],
      unscopedCount: ids.length,
      scopedCount: 0,
      truncated: false,
      unsupportedShape: false,
    },
    ctx(),
  )

describe('sink — dedupe key (AA-2 regression)', () => {
  it('two no-context records from different models are TWO rows, not one', async () => {
    const { db, rows } = fakeDb()
    const sink = createShadowSink({ db })

    await sink.write(buildNoContextRecord(ctx({ model: 'Party' })))
    await sink.write(buildNoContextRecord(ctx({ model: 'Invoice' })))

    // Both have an empty diff, so both share one shapeHash and one routeHint ('').
    // Only `kind`/`model`/`operation` being in the key keeps them apart.
    expect(rows.size).toBe(2)
  })

  it('different operations on one model are separate rows', async () => {
    const { db, rows } = fakeDb()
    const sink = createShadowSink({ db })

    await sink.write(buildNoContextRecord(ctx({ operation: 'findMany' })))
    await sink.write(buildNoContextRecord(ctx({ operation: 'findFirst' })))

    expect(rows.size).toBe(2)
  })

  it('a shadow-error does not merge into the no-context population', async () => {
    const { db, rows } = fakeDb()
    const sink = createShadowSink({ db })

    const err = buildNoContextRecord(ctx())
    await sink.write({ ...err, kind: 'shadow-error', errorName: 'PrismaClientKnownRequestError' })
    await sink.write(buildNoContextRecord(ctx()))

    // Merging them would corrupt the `shadow-error < 0.1% of sampled` criterion.
    expect(rows.size).toBe(2)
  })

  it('the identical record twice is one row, and increments suppressed', async () => {
    const { db, rows, calls } = fakeDb()
    const sink = createShadowSink({ db })

    await sink.write(buildNoContextRecord(ctx()))
    await sink.write(buildNoContextRecord(ctx()))

    expect(rows.size).toBe(1)
    expect(calls[1].update).toMatchObject({ suppressed: { increment: 1 } })
  })
})

describe('sink — upsert payload', () => {
  it('writes the full record on create and refreshes magnitude on update', async () => {
    const { db, calls } = fakeDb()
    const sink = createShadowSink({ db })
    await sink.write(divergence(['a', 'b']))

    expect(calls[0].create).toMatchObject({
      kind: 'diverged',
      model: 'Party',
      onlyUnscoped: ['a', 'b'],
      unscopedCount: 2,
      provenance: 'job',
    })
    // lastSeenAt is @updatedAt in the schema, so the update deliberately does not
    // set it — retention runs on it and must see a still-firing row as fresh.
    expect(calls[0].update).not.toHaveProperty('lastSeenAt')
  })
})

describe('sink — hourly distinct-key cap (FM-11)', () => {
  it('sheds NEW keys past the cap but keeps counting known ones', async () => {
    const { db, rows, calls } = fakeDb()
    const sink = createShadowSink({ db })

    for (let i = 0; i < SHADOW_MAX_KEYS_PER_HOUR; i += 1) {
      await sink.write(buildNoContextRecord(ctx({ model: `Model${i}` })))
    }
    expect(rows.size).toBe(SHADOW_MAX_KEYS_PER_HOUR)

    await sink.write(buildNoContextRecord(ctx({ model: 'OneTooMany' })))
    expect(rows.size).toBe(SHADOW_MAX_KEYS_PER_HOUR)
    expect(sink.snapshot().keyCapShed).toBe(1)

    // A key already admitted still writes — the cap bounds how many new shapes an
    // hour may create, not how often a known one may be counted.
    const before = calls.length
    await sink.write(buildNoContextRecord(ctx({ model: 'Model0' })))
    expect(calls.length).toBe(before + 1)
    expect(sink.snapshot().keyCapShed).toBe(1)
  })

  it('the key set resets on the hour boundary', async () => {
    let t = Date.parse('2026-07-21T10:59:00Z')
    const { db } = fakeDb()
    const sink = createShadowSink({ db, now: () => t })

    await sink.write(buildNoContextRecord(ctx()))
    expect(sink.snapshot().keysThisHour).toBe(1)

    t = Date.parse('2026-07-21T11:00:01Z')
    await sink.write(buildNoContextRecord(ctx({ model: 'Other' })))
    expect(sink.snapshot().keysThisHour).toBe(1)
  })
})
