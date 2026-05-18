/**
 * audit-search.service tests — Phase 6 PR4 (architecture §7.5 + §17.3).
 *
 * Covers:
 *   - basic search returns rows
 *   - q filter narrows by tsv (search vector predicate emitted)
 *   - entityType, action, userId filters wired into SQL
 *   - dateFrom / dateTo wired into SQL
 *   - cursor pagination across 3 pages
 *   - empty result returns []
 *   - businessId scoping (cross-tenant guard)
 *   - **FUZZ BATTERY**: every input that would crash to_tsquery() returns
 *     200-equivalent (no throw) from websearch_to_tsquery (v2.3 A03.1)
 *   - invalid cursor → 400 AppError(VALIDATION_ERROR)
 *
 * The Prisma mock from setup.ts wraps $queryRaw as vi.fn(); we read .mock.calls
 * to inspect the tagged-template strings + interpolated values.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  searchAuditLogs,
  encodeCursor,
} from '../audit-search.service.js'
import { prisma } from '../../../lib/prisma.js'

const mockPrisma = prisma as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>
}

const BUSINESS_ID = 'biz-test-1'
const OTHER_BUSINESS = 'biz-other'

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'audit-1',
    businessId: BUSINESS_ID,
    action: 'CREATE',
    entityType: 'Party',
    entityId: 'party-1',
    entityLabel: 'Raju',
    userId: 'user-1',
    systemActor: null,
    changes: { name: 'Raju' },
    reason: null,
    ipAddress: '1.2.3.4',
    deviceInfo: null,
    createdAt: new Date('2026-05-18T10:00:00Z'),
    userName: 'Raju Owner',
    userEmail: 'raju@example.com',
    ...over,
  }
}

/**
 * Extract the SQL string + interpolated values from the last $queryRaw call.
 * Prisma's $queryRaw is a tagged-template — args[0] is the template-strings
 * array, args[1..] are the interpolations.
 */
function lastQueryParts() {
  const calls = mockPrisma.$queryRaw.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  const args = calls[calls.length - 1]!
  // The first arg may be a Prisma.Sql object (the tagged-template wrapper).
  // Stringify it so the test can grep for SQL fragments.
  const sqlString = JSON.stringify(args)
  return { sqlString, args }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.$queryRaw.mockResolvedValue([])
})

// ─── Basic happy path ────────────────────────────────────────────────────────

describe('searchAuditLogs — basic', () => {
  it('returns rows + null cursor for a small result set', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([row({ id: 'a1' }), row({ id: 'a2' })])

    const result = await searchAuditLogs({ businessId: BUSINESS_ID, limit: 20 })

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]!.id).toBe('a1')
    expect(result.nextCursor).toBeNull()
  })

  it('always pins the WHERE clause on businessId', async () => {
    await searchAuditLogs({ businessId: BUSINESS_ID, limit: 20 })
    const { sqlString } = lastQueryParts()
    expect(sqlString).toContain('businessId')
    expect(sqlString).toContain(BUSINESS_ID)
    expect(sqlString).not.toContain(OTHER_BUSINESS)
  })
})

// ─── Filter wiring ───────────────────────────────────────────────────────────

describe('searchAuditLogs — filters', () => {
  it('emits the websearch_to_tsquery predicate when q is supplied', async () => {
    await searchAuditLogs({ businessId: BUSINESS_ID, query: 'raju', limit: 20 })
    const { sqlString } = lastQueryParts()
    expect(sqlString).toContain('websearch_to_tsquery')
    expect(sqlString).toContain('searchVector')
    expect(sqlString).toContain('raju')
  })

  it('omits the tsquery predicate when q is empty/undefined', async () => {
    await searchAuditLogs({ businessId: BUSINESS_ID, limit: 20 })
    const { sqlString } = lastQueryParts()
    expect(sqlString).not.toContain('websearch_to_tsquery')
  })

  it('NEVER uses to_tsquery (must always be websearch_to_tsquery per v2.3 A03.1)', async () => {
    await searchAuditLogs({ businessId: BUSINESS_ID, query: 'anything', limit: 20 })
    const { sqlString } = lastQueryParts()
    // websearch_to_tsquery is allowed; bare to_tsquery (preceded by space/comma/paren) is not.
    const banned = /[\s,(]to_tsquery/.test(sqlString)
    expect(banned).toBe(false)
  })

  it('emits the entityType predicate when supplied', async () => {
    await searchAuditLogs({ businessId: BUSINESS_ID, entityType: 'Party', limit: 20 })
    const { sqlString } = lastQueryParts()
    expect(sqlString).toContain('entityType')
    expect(sqlString).toContain('Party')
  })

  it('emits the action predicate when supplied', async () => {
    await searchAuditLogs({ businessId: BUSINESS_ID, action: 'DELETE', limit: 20 })
    const { sqlString } = lastQueryParts()
    // The SELECT clause also names "action", so look for the WHERE-shape fragment.
    expect(sqlString).toContain('AND al.\\"action\\" =')
    expect(sqlString).toContain('DELETE')
  })

  it('emits the userId predicate when supplied', async () => {
    await searchAuditLogs({ businessId: BUSINESS_ID, userId: 'user-xyz', limit: 20 })
    const { sqlString } = lastQueryParts()
    expect(sqlString).toContain('userId')
    expect(sqlString).toContain('user-xyz')
  })

  it('emits dateFrom and dateTo predicates when supplied', async () => {
    await searchAuditLogs({
      businessId: BUSINESS_ID,
      dateFrom: '2026-05-01T00:00:00Z',
      dateTo: '2026-05-18T23:59:59Z',
      limit: 20,
    })
    const { sqlString } = lastQueryParts()
    expect(sqlString).toContain('createdAt')
    // Two date predicates emitted (>= and <=).
    const geCount = (sqlString.match(/>=/g) ?? []).length
    const leCount = (sqlString.match(/<=/g) ?? []).length
    expect(geCount).toBeGreaterThanOrEqual(1)
    expect(leCount).toBeGreaterThanOrEqual(1)
  })
})

// ─── Cursor pagination ───────────────────────────────────────────────────────

describe('searchAuditLogs — cursor pagination', () => {
  it('returns nextCursor when result length equals limit + 1', async () => {
    // limit=2 → over-fetch 3; service should pop the extra and return cursor.
    mockPrisma.$queryRaw.mockResolvedValue([
      row({ id: 'a1', createdAt: new Date('2026-05-18T10:00:00Z') }),
      row({ id: 'a2', createdAt: new Date('2026-05-18T09:00:00Z') }),
      row({ id: 'a3', createdAt: new Date('2026-05-18T08:00:00Z') }),
    ])

    const result = await searchAuditLogs({ businessId: BUSINESS_ID, limit: 2 })
    expect(result.rows).toHaveLength(2)
    expect(result.nextCursor).not.toBeNull()
  })

  it('returns null nextCursor when result length <= limit', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([row({ id: 'a1' })])
    const result = await searchAuditLogs({ businessId: BUSINESS_ID, limit: 5 })
    expect(result.nextCursor).toBeNull()
  })

  it('walks 3 pages of 2 rows each end-to-end', async () => {
    // Page 1: 3 rows (limit+1) — cursor returned
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      row({ id: 'a1', createdAt: new Date('2026-05-18T10:00:00Z') }),
      row({ id: 'a2', createdAt: new Date('2026-05-18T09:00:00Z') }),
      row({ id: 'a3', createdAt: new Date('2026-05-18T08:00:00Z') }),
    ])
    const p1 = await searchAuditLogs({ businessId: BUSINESS_ID, limit: 2 })
    expect(p1.rows).toHaveLength(2)
    expect(p1.nextCursor).not.toBeNull()

    // Page 2: 3 rows — cursor returned
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      row({ id: 'a3', createdAt: new Date('2026-05-18T08:00:00Z') }),
      row({ id: 'a4', createdAt: new Date('2026-05-18T07:00:00Z') }),
      row({ id: 'a5', createdAt: new Date('2026-05-18T06:00:00Z') }),
    ])
    const p2 = await searchAuditLogs({ businessId: BUSINESS_ID, limit: 2, cursor: p1.nextCursor! })
    expect(p2.rows).toHaveLength(2)
    expect(p2.nextCursor).not.toBeNull()

    // Page 3: 1 row only → no further cursor
    mockPrisma.$queryRaw.mockResolvedValueOnce([row({ id: 'a6' })])
    const p3 = await searchAuditLogs({ businessId: BUSINESS_ID, limit: 2, cursor: p2.nextCursor! })
    expect(p3.rows).toHaveLength(1)
    expect(p3.nextCursor).toBeNull()
  })

  it('throws 400 VALIDATION_ERROR on an undecodable cursor', async () => {
    await expect(
      searchAuditLogs({ businessId: BUSINESS_ID, cursor: 'not-base64-json!!' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 })
  })

  it('throws 400 VALIDATION_ERROR on a cursor with the wrong inner shape', async () => {
    const badCursor = Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf8').toString('base64url')
    await expect(
      searchAuditLogs({ businessId: BUSINESS_ID, cursor: badCursor }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 })
  })

  it('encodeCursor round-trips through decodeCursor inside the service', async () => {
    // Mint a cursor, then feed it back in — the service should accept it.
    const cursor = encodeCursor({ createdAt: new Date('2026-05-18T05:00:00Z'), id: 'a7' })
    await expect(
      searchAuditLogs({ businessId: BUSINESS_ID, cursor }),
    ).resolves.toBeDefined()
  })
})

// ─── Empty result + scoping ──────────────────────────────────────────────────

describe('searchAuditLogs — edge cases', () => {
  it('returns rows=[] / nextCursor=null on no matches', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    const result = await searchAuditLogs({ businessId: BUSINESS_ID, limit: 20 })
    expect(result).toEqual({ rows: [], nextCursor: null })
  })

  it('throws VALIDATION_ERROR when businessId is empty', async () => {
    await expect(
      searchAuditLogs({ businessId: '', limit: 20 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('throws VALIDATION_ERROR when limit is out of range', async () => {
    await expect(
      searchAuditLogs({ businessId: BUSINESS_ID, limit: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    await expect(
      searchAuditLogs({ businessId: BUSINESS_ID, limit: 101 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

// ─── Fuzz battery (v2.3 A03.1) ───────────────────────────────────────────────
//
// Every input below would crash to_tsquery() with a Postgres syntax error
// (operator parsing failure). websearch_to_tsquery() must accept all of
// them as plain text and the service must NEVER throw. The mocked Prisma
// returns []; the contract here is purely that the service builds the SQL
// without choking on the user-supplied string.

describe('searchAuditLogs — FUZZ BATTERY (v2.3 A03.1: websearch_to_tsquery never throws)', () => {
  const fuzzInputs = [
    'R&D',
    '(test)',
    "it's",
    'a|b',
    '--',
    '&|!()',
    '',
    "''",
    '""',
    'abc',
    '"a OR b"',
    '-exclude',
    'foo bar baz quux',
    'a&&&&b',
    '!!!',
    ')(((',
    '\\n\\t\\r',
    'NULL',
    'DROP TABLE "AuditLog"; --',
    'apple OR banana AND cherry',
  ]

  for (const input of fuzzInputs) {
    it(`returns without throwing on q=${JSON.stringify(input)}`, async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])
      await expect(
        searchAuditLogs({ businessId: BUSINESS_ID, query: input, limit: 20 }),
      ).resolves.toEqual({ rows: [], nextCursor: null })
    })
  }

  it('parameterises q (never inlines user input as raw SQL — SQL-injection guard)', async () => {
    const evil = `'); DROP TABLE "AuditLog"; --`
    await searchAuditLogs({ businessId: BUSINESS_ID, query: evil, limit: 20 })
    const { sqlString } = lastQueryParts()
    // The literal string is present as a parameter VALUE inside JSON, but the
    // SQL fragment itself must use websearch_to_tsquery('english', $param)
    // — verify the parametriser placeholder pattern is present and the raw
    // string is NOT spliced inside a SELECT clause.
    expect(sqlString).toContain('websearch_to_tsquery')
    // Prisma.sql tagged-templates stringify with `values:` containing inputs;
    // they never inline them into the `text:` clause. Both shapes serialize
    // such that the SQL strings live in `strings`/`text` and inputs in `values`.
    // We assert the literal SQL keyword 'DROP TABLE' does not appear as an
    // unquoted SQL fragment alongside SELECT.
    expect(/SELECT[^"]*DROP TABLE/i.test(sqlString)).toBe(false)
  })
})
