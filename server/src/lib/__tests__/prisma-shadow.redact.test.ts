/**
 * File #10 — record construction and the PII wall. No DB (ARCHITECTURE §9.2, §9.3).
 *
 * The strongest guarantee in this module is structural rather than testable: the
 * builders never take `args`, a returned row, `err`, or `req` as a parameter, so
 * they cannot leak what they never receive. What IS testable, and tested here:
 * the key allowlist emits exactly the declared keys (an added field cannot ride
 * along unnoticed), `errorName` never carries `err.message`, and the id cap holds
 * at the persistence boundary even when handed an uncapped diff.
 *
 * The winston-bytes and persisted-row halves of the PII assertion live in the
 * integration suite (§9.2) — they need a real logger chain and a real row.
 */
import { describe, it, expect } from 'vitest'
import {
  buildRecord,
  buildNoContextRecord,
  buildErrorRecord,
  shapeHashOf,
  type ShadowRecordContext,
} from '../prisma-shadow.redact.js'
import { SHADOW_MAX_IDS } from '../prisma-shadow.constants.js'
import type { RequestMeta, ShadowDiff } from '../prisma-shadow.types.js'

const meta = (over: Partial<RequestMeta> = {}): RequestMeta => ({
  method: 'GET',
  getRouteHint: () => '/api/parties/:id',
  hadBusinessOnToken: true,
  ...over,
})

const ctx = (over: Partial<ShadowRecordContext> = {}): ShadowRecordContext => ({
  model: 'Party',
  operation: 'findMany',
  meta: meta(),
  subjectBusinessId: 'biz-1',
  observationIntervalMs: 9,
  argFlags: { hasInclude: false, hasBoundedWindow: false },
  ...over,
})

const diff = (over: Partial<ShadowDiff> = {}): ShadowDiff => ({
  onlyUnscoped: [],
  onlyScoped: [],
  unscopedCount: 0,
  scopedCount: 0,
  truncated: false,
  unsupportedShape: false,
  ...over,
})

const ALLOWED_KEYS = [
  'kind',
  'model',
  'operation',
  'provenance',
  'subjectBusinessId',
  'routeHint',
  'hadBusinessOnToken',
  'onlyUnscoped',
  'onlyScoped',
  'unscopedCount',
  'scopedCount',
  'truncated',
  'hasInclude',
  'hasBoundedWindow',
  'observationIntervalMs',
  'errorName',
  'shapeHash',
].sort()

describe('redact — key allowlist (§9.2)', () => {
  it('emits exactly the declared keys, no more', () => {
    const r = buildRecord('diverged', diff({ onlyUnscoped: ['x'], unscopedCount: 1 }), ctx())
    expect(Object.keys(r).sort()).toEqual(ALLOWED_KEYS)
  })

  it('every builder produces the same key set', () => {
    expect(Object.keys(buildNoContextRecord(ctx())).sort()).toEqual(ALLOWED_KEYS)
    expect(Object.keys(buildErrorRecord(new Error('x'), ctx())).sort()).toEqual(ALLOWED_KEYS)
  })

  it('routeHint is the matched template supplied by RequestMeta', () => {
    const r = buildRecord('diverged', diff({ onlyScoped: ['x'] }), ctx())
    expect(r.routeHint).toBe('/api/parties/:id')
  })
})

describe('redact — errorName only, never err.message', () => {
  it('keeps the name and drops the message', () => {
    const err = new Error('Invalid `prisma.party.findMany()`: phone=+919876543210')
    err.name = 'PrismaClientValidationError'
    const r = buildErrorRecord(err, ctx())

    expect(r.errorName).toBe('PrismaClientValidationError')
    expect(JSON.stringify(r)).not.toContain('9876543210')
  })

  it('labels non-Error throws without stringifying them', () => {
    expect(buildErrorRecord('phone=+919876543210', ctx()).errorName).toBe('StringThrow')
    expect(buildErrorRecord({ secret: 1 }, ctx()).errorName).toBe('UnknownThrow')
  })
})

describe('redact — id cap re-asserted at the persistence boundary (B-6, AC-28)', () => {
  it('caps an uncapped diff handed in from elsewhere', () => {
    const uncapped = diff({
      onlyUnscoped: Array.from({ length: 500 }, (_, i) => `id-${i}`),
      unscopedCount: 500,
    })
    const r = buildRecord('diverged', uncapped, ctx())

    expect(r.onlyUnscoped).toHaveLength(SHADOW_MAX_IDS)
    expect(r.truncated).toBe(true)
    expect(r.unscopedCount).toBe(500)
  })

  it('shapeHash is computed over the CAPPED ids, so it is stable across rows', () => {
    const uncapped = diff({ onlyUnscoped: Array.from({ length: 500 }, (_, i) => `id-${i}`) })
    const capped = diff({ onlyUnscoped: uncapped.onlyUnscoped.slice(0, SHADOW_MAX_IDS) })
    expect(buildRecord('diverged', uncapped, ctx()).shapeHash).toBe(shapeHashOf(capped))
  })
})

describe('redact — provenance and no-context (AA-3)', () => {
  it('no RequestMeta means the job path', () => {
    const r = buildNoContextRecord(ctx({ meta: undefined }))
    expect(r.provenance).toBe('job')
    expect(r.routeHint).toBe('')
    expect(r.hadBusinessOnToken).toBe(false)
  })

  it('a lost frame is distinguishable from a legitimately tenant-less request', () => {
    const lost = buildNoContextRecord(ctx({ meta: meta({ hadBusinessOnToken: true }) }))
    const legit = buildNoContextRecord(ctx({ meta: meta({ hadBusinessOnToken: false }) }))

    // Only the first sub-population is gated at zero — without this bit the two
    // are one undifferentiated count and the gate is unachievable.
    expect(lost.hadBusinessOnToken).toBe(true)
    expect(legit.hadBusinessOnToken).toBe(false)
    expect(lost.provenance).toBe('http')
  })

  it('no-context always nulls subjectBusinessId', () => {
    expect(buildNoContextRecord(ctx({ subjectBusinessId: 'biz-1' })).subjectBusinessId).toBeNull()
  })
})

describe('redact — shapeHash (D-6, D-11)', () => {
  it('is order-independent', () => {
    expect(shapeHashOf(diff({ onlyUnscoped: ['b', 'a'] }))).toBe(
      shapeHashOf(diff({ onlyUnscoped: ['a', 'b'] })),
    )
  })

  it('every empty-diff kind shares one hash — which is why kind is in the key', () => {
    const empty = shapeHashOf(diff())
    expect(buildNoContextRecord(ctx()).shapeHash).toBe(empty)
    expect(buildErrorRecord(new Error('x'), ctx()).shapeHash).toBe(empty)
    // Keyed on shapeHash alone (rev 2), this whole population collapses into one
    // row. The unique constraint is [kind, model, operation, shapeHash, routeHint].
    expect(buildNoContextRecord(ctx()).kind).not.toBe(buildErrorRecord(new Error('x'), ctx()).kind)
  })
})
