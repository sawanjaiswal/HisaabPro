/**
 * Roles service — audit-write smoke (PR7 backfill).
 *
 * Asserts createRole / updateRole / deleteRole each write ONE Role audit row
 * inside their tx, with userId set from the route layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRole, updateRole, deleteRole } from '../roles.js'
import { prisma } from '../../../lib/prisma.js'

vi.mock('../permissions.js', () => ({
  VALID_PERMISSIONS: new Set(['invoicing.create', 'invoicing.edit']),
  ensureSystemRoles: vi.fn(),
}))

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const BUSINESS_ID = 'biz-1'
const ROLE_ID = 'role-1'
const USER_ID = 'user-actor'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createRole — audit', () => {
  it('writes one Role CREATE audit row with userId', async () => {
    mockPrisma.role.create.mockResolvedValue({ id: ROLE_ID, name: 'Custom Role' })

    await createRole(BUSINESS_ID, USER_ID, {
      name: 'Custom Role',
      permissions: ['invoicing.create'],
      isDefault: false,
    })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Role',
        entityId: ROLE_ID,
        userId: USER_ID,
        action: 'CREATE',
      }),
    })
  })
})

describe('updateRole — audit', () => {
  it('writes one Role UPDATE audit row with userId', async () => {
    mockPrisma.role.findFirst.mockResolvedValue({ isSystem: false, name: 'Custom' })
    mockPrisma.role.update.mockResolvedValue({ id: ROLE_ID, name: 'Custom Renamed' })

    await updateRole(BUSINESS_ID, ROLE_ID, USER_ID, { name: 'Custom Renamed' })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Role',
        entityId: ROLE_ID,
        userId: USER_ID,
        action: 'UPDATE',
      }),
    })
  })
})

describe('deleteRole — audit', () => {
  it('writes one Role DELETE audit row with userId', async () => {
    mockPrisma.role.findFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      where.id === ROLE_ID
        ? Promise.resolve({ isSystem: false, name: 'Custom' })
        : Promise.resolve({ id: 'fallback' }),
    )
    mockPrisma.businessUser.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.role.update.mockResolvedValue({ id: ROLE_ID })

    await deleteRole(BUSINESS_ID, ROLE_ID, USER_ID, 'fallback')

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'Role',
        entityId: ROLE_ID,
        userId: USER_ID,
        action: 'DELETE',
      }),
    })
  })
})
