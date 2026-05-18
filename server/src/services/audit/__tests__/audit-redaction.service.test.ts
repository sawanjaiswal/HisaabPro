/**
 * audit-redaction.service tests — Phase 6 PR4 (architecture §7.6).
 *
 * Covers:
 *   - list / upsert / disable round trip
 *   - applyRedactionsToRow: no-op when no rules
 *   - masks single field
 *   - masks nested field via dot path
 *   - masks multiple fields in one row
 *   - disabled redaction is NOT applied
 *   - rules for other entityType are NOT applied
 *   - non-object `changes` returns row unchanged (string / null / array)
 *   - prototype-pollution defense: `__proto__.x` segment is a no-op
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  listRedactions,
  setRedaction,
  disableRedaction,
  applyRedactionsToRow,
  applyRedactionsToRows,
  type AuditRedaction,
} from '../audit-redaction.service.js'
import { prisma } from '../../../lib/prisma.js'

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-test-1'
const ACTOR_ID = 'user-actor-1'

function redaction(over: Partial<AuditRedaction>): AuditRedaction {
  return {
    id: 'red-1',
    businessId: BUSINESS_ID,
    entityType: 'Party',
    fieldPath: 'phone',
    enabled: true,
    createdAt: new Date('2026-05-18T00:00:00Z'),
    createdById: ACTOR_ID,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── DB-touching service methods ─────────────────────────────────────────────

describe('listRedactions', () => {
  it('queries auditLogRedaction.findMany scoped to businessId', async () => {
    const rows = [redaction({ id: 'r1' }), redaction({ id: 'r2', fieldPath: 'email' })]
    mockPrisma.auditLogRedaction.findMany.mockResolvedValue(rows)

    const result = await listRedactions(BUSINESS_ID)

    expect(result).toEqual(rows)
    expect(mockPrisma.auditLogRedaction.findMany).toHaveBeenCalledWith({
      where: { businessId: BUSINESS_ID },
      orderBy: [{ entityType: 'asc' }, { fieldPath: 'asc' }],
    })
  })
})

describe('setRedaction', () => {
  it('upserts via the composite unique key (businessId, entityType, fieldPath)', async () => {
    const out = redaction({ id: 'new-1' })
    mockPrisma.auditLogRedaction.upsert.mockResolvedValue(out)

    const result = await setRedaction({
      businessId: BUSINESS_ID,
      entityType: 'Party',
      fieldPath: 'phone',
      enabled: true,
      createdById: ACTOR_ID,
    })

    expect(result).toEqual(out)
    expect(mockPrisma.auditLogRedaction.upsert).toHaveBeenCalledWith({
      where: {
        businessId_entityType_fieldPath: {
          businessId: BUSINESS_ID,
          entityType: 'Party',
          fieldPath: 'phone',
        },
      },
      create: {
        businessId: BUSINESS_ID,
        entityType: 'Party',
        fieldPath: 'phone',
        enabled: true,
        createdById: ACTOR_ID,
      },
      update: { enabled: true },
    })
  })

  it('defaults enabled=true when not supplied', async () => {
    mockPrisma.auditLogRedaction.upsert.mockResolvedValue(redaction({}))
    await setRedaction({
      businessId: BUSINESS_ID,
      entityType: 'Party',
      fieldPath: 'phone',
      createdById: ACTOR_ID,
    })
    const args = mockPrisma.auditLogRedaction.upsert.mock.calls[0]![0]
    expect(args.create.enabled).toBe(true)
    expect(args.update.enabled).toBe(true)
  })
})

describe('disableRedaction', () => {
  it('flips enabled=false when the row belongs to the business', async () => {
    mockPrisma.auditLogRedaction.findUnique.mockResolvedValue(redaction({}))
    mockPrisma.auditLogRedaction.update.mockResolvedValue(redaction({ enabled: false }))

    const result = await disableRedaction({ businessId: BUSINESS_ID, id: 'red-1' })

    expect(result.enabled).toBe(false)
    expect(mockPrisma.auditLogRedaction.update).toHaveBeenCalledWith({
      where: { id: 'red-1' },
      data: { enabled: false },
    })
  })

  it('throws 404 when the redaction id does not exist', async () => {
    mockPrisma.auditLogRedaction.findUnique.mockResolvedValue(null)
    await expect(
      disableRedaction({ businessId: BUSINESS_ID, id: 'missing' }),
    ).rejects.toThrow('Redaction rule not found')
    expect(mockPrisma.auditLogRedaction.update).not.toHaveBeenCalled()
  })

  it('throws 404 when the redaction belongs to a different business (cross-tenant guard)', async () => {
    mockPrisma.auditLogRedaction.findUnique.mockResolvedValue(redaction({ businessId: 'other-biz' }))
    await expect(
      disableRedaction({ businessId: BUSINESS_ID, id: 'red-1' }),
    ).rejects.toThrow('Redaction rule not found')
    expect(mockPrisma.auditLogRedaction.update).not.toHaveBeenCalled()
  })
})

// ─── Pure read-time masking ──────────────────────────────────────────────────

describe('applyRedactionsToRow', () => {
  const row = {
    entityType: 'Party',
    changes: { name: 'Raju', phone: '9876543210', email: 'r@example.com' },
  }

  it('returns the row unchanged when no redactions exist', () => {
    expect(applyRedactionsToRow(row, [])).toEqual(row)
  })

  it('masks a single top-level field', () => {
    const out = applyRedactionsToRow(row, [redaction({ fieldPath: 'phone' })])
    expect((out.changes as Record<string, unknown>).phone).toBe('<redacted>')
    expect((out.changes as Record<string, unknown>).name).toBe('Raju')
  })

  it('masks a nested field via dot path', () => {
    const nestedRow = {
      entityType: 'Party',
      changes: { name: 'Raju', address: { city: 'Mumbai', pincode: '400001' } },
    }
    const out = applyRedactionsToRow(nestedRow, [redaction({ fieldPath: 'address.city' })])
    const changes = out.changes as { address: { city: unknown; pincode: unknown } }
    expect(changes.address.city).toBe('<redacted>')
    expect(changes.address.pincode).toBe('400001')
  })

  it('masks multiple fields in one row', () => {
    const out = applyRedactionsToRow(row, [
      redaction({ id: 'r1', fieldPath: 'phone' }),
      redaction({ id: 'r2', fieldPath: 'email' }),
    ])
    const c = out.changes as Record<string, unknown>
    expect(c.phone).toBe('<redacted>')
    expect(c.email).toBe('<redacted>')
    expect(c.name).toBe('Raju')
  })

  it('skips disabled redactions', () => {
    const out = applyRedactionsToRow(row, [
      redaction({ fieldPath: 'phone', enabled: false }),
    ])
    expect((out.changes as Record<string, unknown>).phone).toBe('9876543210')
  })

  it('skips redactions for a different entityType', () => {
    const out = applyRedactionsToRow(row, [
      redaction({ entityType: 'Invoice', fieldPath: 'phone' }),
    ])
    expect((out.changes as Record<string, unknown>).phone).toBe('9876543210')
  })

  it('does not mutate the input row', () => {
    const input = { entityType: 'Party', changes: { phone: '9876543210' } }
    const original = JSON.parse(JSON.stringify(input))
    applyRedactionsToRow(input, [redaction({ fieldPath: 'phone' })])
    expect(input).toEqual(original)
  })

  it('returns the row unchanged when changes is null', () => {
    const r = { entityType: 'Party', changes: null }
    expect(applyRedactionsToRow(r, [redaction({ fieldPath: 'phone' })])).toEqual(r)
  })

  it('returns the row unchanged when changes is a string scalar', () => {
    const r = { entityType: 'Party', changes: 'just a note' }
    expect(applyRedactionsToRow(r, [redaction({ fieldPath: 'phone' })])).toEqual(r)
  })

  it('returns the row unchanged when changes is an array', () => {
    const r = { entityType: 'Party', changes: [1, 2, 3] }
    expect(applyRedactionsToRow(r, [redaction({ fieldPath: 'phone' })])).toEqual(r)
  })

  it('refuses to walk prototype-polluting paths (__proto__.x)', () => {
    const r = { entityType: 'Party', changes: { phone: '9876543210' } }
    const out = applyRedactionsToRow(r, [redaction({ fieldPath: '__proto__.polluted' })])
    // Should not throw, should not pollute Object.prototype
    expect((Object.prototype as unknown as Record<string, unknown>).polluted).toBeUndefined()
    expect(out.changes).toEqual({ phone: '9876543210' })
  })

  it('is a no-op when the dot path traverses a missing intermediate', () => {
    const r = { entityType: 'Party', changes: { phone: '9876543210' } }
    const out = applyRedactionsToRow(r, [redaction({ fieldPath: 'address.city' })])
    expect(out.changes).toEqual({ phone: '9876543210' })
  })
})

describe('applyRedactionsToRows', () => {
  it('returns a copy of the input list when there are no rules', () => {
    const rows = [{ entityType: 'Party', changes: { phone: 'x' } }]
    const out = applyRedactionsToRows(rows, [])
    expect(out).toEqual(rows)
    expect(out).not.toBe(rows)
  })

  it('applies the same redaction set to every row', () => {
    const rows = [
      { entityType: 'Party', changes: { phone: '1' } },
      { entityType: 'Party', changes: { phone: '2', name: 'B' } },
      { entityType: 'Invoice', changes: { total: 100 } }, // ignored — wrong entityType
    ]
    const out = applyRedactionsToRows(rows, [redaction({ fieldPath: 'phone' })])
    expect((out[0]!.changes as Record<string, unknown>).phone).toBe('<redacted>')
    expect((out[1]!.changes as Record<string, unknown>).phone).toBe('<redacted>')
    expect((out[2]!.changes as Record<string, unknown>).total).toBe(100)
  })
})
