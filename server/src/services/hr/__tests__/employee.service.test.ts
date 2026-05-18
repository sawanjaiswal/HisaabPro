/**
 * employee.service tests — Phase 6 PR6 (architecture §4 + §8.5 + §18.7).
 *
 * Covers:
 *   - createEmployee — happy path writes Party(STAFF) + Employee + audit ONE tx
 *   - createEmployee — defaults phone/designation/userId to null when omitted
 *   - updateEmployee — happy path patches Employee, mirrors name/phone to Party
 *   - updateEmployee — partyId NEVER mutated (immutable per §8.5)
 *   - updateEmployee — 404 EMPLOYEE_NOT_FOUND on missing OR cross-tenant
 *   - deleteEmployee — soft-deletes Employee + Party in same tx
 *   - deleteEmployee — 404 EMPLOYEE_NOT_FOUND on missing OR cross-tenant
 *   - listEmployees — tenant-scoped findMany, hides soft-deleted by default
 *   - listEmployees — cursor pagination yields nextCursor when spillover
 *   - getEmployee  — 404 EMPLOYEE_NOT_FOUND on missing OR cross-tenant
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listEmployees,
  getEmployee,
} from '../employee.service.js'
import { prisma } from '../../../lib/prisma.js'

const mockPrisma = prisma as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>

const BUSINESS_ID = 'biz-test-1'
const ACTOR = 'user-actor-1'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── createEmployee ─────────────────────────────────────────────────────────

describe('createEmployee — happy path', () => {
  it('writes Party(STAFF) + Employee + audit in ONE tx; returns both rows', async () => {
    mockPrisma.party.create.mockResolvedValue({
      id: 'party-1',
      businessId: BUSINESS_ID,
      type: 'STAFF',
      name: 'Anil',
      phone: '9999999999',
    })
    mockPrisma.employee.create.mockResolvedValue({
      id: 'emp-1',
      businessId: BUSINESS_ID,
      partyId: 'party-1',
      userId: null,
      name: 'Anil',
      phone: '9999999999',
      designation: 'Driver',
      dailyRate: 50000,
    })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })

    const result = await createEmployee(
      {
        name: 'Anil',
        phone: '9999999999',
        designation: 'Driver',
        dailyRatePaise: 50000,
      },
      { userId: ACTOR, businessId: BUSINESS_ID },
    )

    expect(result.party.id).toBe('party-1')
    expect(result.employee.id).toBe('emp-1')
    expect(result.employee.partyId).toBe('party-1')

    // Party.create called with type='STAFF' and tenant-scoped businessId
    expect(mockPrisma.party.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        type: 'STAFF',
        name: 'Anil',
        phone: '9999999999',
      }),
    })

    // Employee.create wired to the Party
    expect(mockPrisma.employee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        partyId: 'party-1',
        name: 'Anil',
        dailyRate: 50000,
        createdById: ACTOR,
      }),
    })

    // ONE audit row with the dailyRatePaise + partyId payload
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Employee',
        entityId: 'emp-1',
        action: 'CREATE',
        userId: ACTOR,
        changes: expect.objectContaining({
          partyId: 'party-1',
          dailyRatePaise: 50000,
        }),
      }),
    })

    // $transaction was used — single atomic write
    const txMock = (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction
    expect(txMock).toHaveBeenCalled()
  })

  it('defaults phone/designation/userId to null when omitted', async () => {
    mockPrisma.party.create.mockResolvedValue({ id: 'party-1' })
    mockPrisma.employee.create.mockResolvedValue({ id: 'emp-1', name: 'X' })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })

    await createEmployee(
      { name: 'X', dailyRatePaise: 1000 },
      { userId: ACTOR, businessId: BUSINESS_ID },
    )

    const partyCall = mockPrisma.party.create.mock.calls[0]![0] as { data: { phone: unknown } }
    expect(partyCall.data.phone).toBeNull()
    const empCall = mockPrisma.employee.create.mock.calls[0]![0] as {
      data: { phone: unknown; designation: unknown; userId: unknown }
    }
    expect(empCall.data.phone).toBeNull()
    expect(empCall.data.designation).toBeNull()
    expect(empCall.data.userId).toBeNull()
  })
})

// ─── updateEmployee ─────────────────────────────────────────────────────────

describe('updateEmployee — happy path', () => {
  it('patches Employee, mirrors name+phone to paired Party, writes diff audit', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      partyId: 'party-1',
      name: 'Old',
      phone: '111',
      designation: 'Driver',
      dailyRate: 50000,
      userId: null,
      leftAt: null,
    })
    mockPrisma.employee.update.mockResolvedValue({ id: 'emp-1', name: 'New' })
    mockPrisma.party.update.mockResolvedValue({ id: 'party-1', name: 'New' })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })

    await updateEmployee(
      'emp-1',
      { name: 'New', phone: '222', dailyRatePaise: 60000 },
      { userId: ACTOR, businessId: BUSINESS_ID },
    )

    // Tenant-scoped findFirst
    expect(mockPrisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'emp-1', businessId: BUSINESS_ID },
      }),
    )

    // Employee.update carries name/phone/dailyRate, NOT partyId
    const empUpdate = mockPrisma.employee.update.mock.calls[0]![0] as {
      data: Record<string, unknown>
    }
    expect(empUpdate.data.name).toBe('New')
    expect(empUpdate.data.phone).toBe('222')
    expect(empUpdate.data.dailyRate).toBe(60000)
    expect('partyId' in empUpdate.data).toBe(false)

    // Party mirrored for name + phone
    expect(mockPrisma.party.update).toHaveBeenCalledWith({
      where: { id: 'party-1' },
      data: { name: 'New', phone: '222' },
    })

    // Audit diff captures old/new pairs only for changed fields
    const auditCall = mockPrisma.auditLog.create.mock.calls[0]![0] as {
      data: { changes: Record<string, { old: unknown; new: unknown }> }
    }
    expect(auditCall.data.changes.name).toEqual({ old: 'Old', new: 'New' })
    expect(auditCall.data.changes.phone).toEqual({ old: '111', new: '222' })
    expect(auditCall.data.changes.dailyRate).toEqual({ old: 50000, new: 60000 })
    expect(auditCall.data.changes.designation).toBeUndefined()
  })

  it('does NOT mirror name/phone to Party when neither is changing', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      partyId: 'party-1',
      name: 'X',
      phone: null,
      designation: 'Driver',
      dailyRate: 50000,
      userId: null,
      leftAt: null,
    })
    mockPrisma.employee.update.mockResolvedValue({ id: 'emp-1' })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })

    await updateEmployee(
      'emp-1',
      { dailyRatePaise: 60000 },
      { userId: ACTOR, businessId: BUSINESS_ID },
    )

    expect(mockPrisma.party.update).not.toHaveBeenCalled()
  })

  it('throws 404 EMPLOYEE_NOT_FOUND on missing OR cross-tenant id', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null)

    await expect(
      updateEmployee('emp-missing', { name: 'X' }, { userId: ACTOR, businessId: BUSINESS_ID }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'EMPLOYEE_NOT_FOUND',
    })

    expect(mockPrisma.employee.update).not.toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled()
  })
})

// ─── deleteEmployee ─────────────────────────────────────────────────────────

describe('deleteEmployee — happy path', () => {
  it('soft-deletes Employee AND Party in the same tx; writes audit', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      partyId: 'party-1',
      name: 'Anil',
      isDeleted: false,
    })
    mockPrisma.employee.update.mockResolvedValue({ id: 'emp-1', isDeleted: true })
    mockPrisma.party.update.mockResolvedValue({ id: 'party-1' })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })

    await deleteEmployee('emp-1', { userId: ACTOR, businessId: BUSINESS_ID })

    // Employee soft-delete flips both flags
    const empUpdate = mockPrisma.employee.update.mock.calls[0]![0] as {
      data: { isDeleted: boolean; deletedAt: Date }
    }
    expect(empUpdate.data.isDeleted).toBe(true)
    expect(empUpdate.data.deletedAt).toBeInstanceOf(Date)

    // Party deactivated + soft-deleted
    const partyUpdate = mockPrisma.party.update.mock.calls[0]![0] as {
      data: { isActive: boolean; isDeleted: boolean; deletedAt: Date }
    }
    expect(partyUpdate.data.isActive).toBe(false)
    expect(partyUpdate.data.isDeleted).toBe(true)
    expect(partyUpdate.data.deletedAt).toBeInstanceOf(Date)

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'Employee',
        entityId: 'emp-1',
        action: 'DELETE',
        userId: ACTOR,
      }),
    })
  })

  it('throws 404 EMPLOYEE_NOT_FOUND on missing OR cross-tenant id', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null)

    await expect(
      deleteEmployee('emp-x', { userId: ACTOR, businessId: BUSINESS_ID }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'EMPLOYEE_NOT_FOUND',
    })

    expect(mockPrisma.employee.update).not.toHaveBeenCalled()
    expect(mockPrisma.party.update).not.toHaveBeenCalled()
  })
})

// ─── listEmployees ──────────────────────────────────────────────────────────

describe('listEmployees', () => {
  it('tenant-scoped, hides soft-deleted by default, orders by name+id', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 'e1', name: 'A' },
      { id: 'e2', name: 'B' },
    ])

    const out = await listEmployees(
      { limit: 20 },
      { userId: ACTOR, businessId: BUSINESS_ID },
    )

    expect(out.rows).toHaveLength(2)
    expect(out.nextCursor).toBeNull()

    const call = mockPrisma.employee.findMany.mock.calls[0]![0] as {
      where: { businessId: string; isDeleted: boolean }
      orderBy: unknown
      take: number
    }
    expect(call.where.businessId).toBe(BUSINESS_ID)
    expect(call.where.isDeleted).toBe(false)
    expect(call.take).toBe(21) // limit + 1 for spillover
  })

  it('yields nextCursor when there are more rows than limit', async () => {
    // 3 rows returned for limit=2 → pop spillover, return 2 + nextCursor
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 'e1', name: 'A' },
      { id: 'e2', name: 'B' },
      { id: 'e3', name: 'C' },
    ])

    const out = await listEmployees(
      { limit: 2 },
      { userId: ACTOR, businessId: BUSINESS_ID },
    )

    expect(out.rows).toHaveLength(2)
    expect(out.nextCursor).toBe('e3')
  })

  it('applies substring filter on name when q provided', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([])

    await listEmployees({ q: 'ani' }, { userId: ACTOR, businessId: BUSINESS_ID })

    const call = mockPrisma.employee.findMany.mock.calls[0]![0] as {
      where: { name: { contains: string; mode: string } }
    }
    expect(call.where.name).toEqual({ contains: 'ani', mode: 'insensitive' })
  })
})

// ─── getEmployee ────────────────────────────────────────────────────────────

describe('getEmployee', () => {
  it('returns row when tenant matches', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', name: 'A' })

    const out = await getEmployee('emp-1', { userId: ACTOR, businessId: BUSINESS_ID })

    expect(out.id).toBe('emp-1')
    const call = mockPrisma.employee.findFirst.mock.calls[0]![0] as {
      where: { id: string; businessId: string }
    }
    expect(call.where.businessId).toBe(BUSINESS_ID)
  })

  it('throws 404 EMPLOYEE_NOT_FOUND on missing OR cross-tenant', async () => {
    mockPrisma.employee.findFirst.mockResolvedValue(null)

    await expect(
      getEmployee('emp-other', { userId: ACTOR, businessId: BUSINESS_ID }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'EMPLOYEE_NOT_FOUND',
    })
  })
})
