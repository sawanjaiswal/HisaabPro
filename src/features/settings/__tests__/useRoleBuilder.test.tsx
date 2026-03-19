import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useRoleBuilder } from '../useRoleBuilder'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockCreateRole = vi.fn()
const mockUpdateRole = vi.fn()
vi.mock('../role.service', () => ({
  createRole: (...args: unknown[]) => mockCreateRole(...args),
  updateRole: (...args: unknown[]) => mockUpdateRole(...args),
  getRole: vi.fn(),
  getRoles: vi.fn(),
}))

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

const BIZ_ID = 'biz-123'

describe('useRoleBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with empty form in create mode', () => {
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })
    expect(result.current.form.name).toBe('')
    expect(result.current.form.permissions).toEqual([])
    expect(result.current.form.isDefault).toBe(false)
    expect(result.current.errors).toEqual({})
  })

  it('initializes from existing role in edit mode', () => {
    const role = {
      id: 'role-1',
      name: 'Manager',
      description: 'Manages stuff',
      permissions: ['invoicing.view', 'invoicing.create'],
      isDefault: true,
      isSystem: false,
      priority: 1,
      staffCount: 3,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const { result } = renderHook(
      () => useRoleBuilder({ businessId: BIZ_ID, role }),
      { wrapper },
    )
    expect(result.current.form.name).toBe('Manager')
    expect(result.current.form.permissions).toEqual(['invoicing.view', 'invoicing.create'])
  })

  it('updateField changes form and clears error', () => {
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })

    // Trigger validation to set errors
    act(() => { result.current.handleSubmit() })
    expect(result.current.errors.name).toBeTruthy()

    // Update field clears the error
    act(() => { result.current.updateField('name', 'Admin') })
    expect(result.current.form.name).toBe('Admin')
    expect(result.current.errors.name).toBeUndefined()
  })

  it('togglePermission adds and removes a key', () => {
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })

    act(() => { result.current.togglePermission('invoicing.view') })
    expect(result.current.form.permissions).toContain('invoicing.view')

    act(() => { result.current.togglePermission('invoicing.view') })
    expect(result.current.form.permissions).not.toContain('invoicing.view')
  })

  it('toggleModuleAll checks all actions in a module', () => {
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })

    act(() => { result.current.toggleModuleAll('invoicing') })
    // invoicing module has: view, create, edit, delete, share
    expect(result.current.form.permissions).toContain('invoicing.view')
    expect(result.current.form.permissions).toContain('invoicing.create')
    expect(result.current.form.permissions).toContain('invoicing.edit')
    expect(result.current.form.permissions).toContain('invoicing.delete')
    expect(result.current.form.permissions).toContain('invoicing.share')
  })

  it('toggleModuleAll unchecks all when all are checked', () => {
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })

    // Check all
    act(() => { result.current.toggleModuleAll('invoicing') })
    // Uncheck all
    act(() => { result.current.toggleModuleAll('invoicing') })
    const invoicingPerms = result.current.form.permissions.filter((p) => p.startsWith('invoicing.'))
    expect(invoicingPerms).toHaveLength(0)
  })

  it('cloneFromTemplate copies permissions from another role', () => {
    const template = {
      id: 'sys-1',
      name: 'Viewer',
      description: null,
      permissions: ['invoicing.view', 'inventory.view', 'payments.view'],
      isSystem: true,
      isDefault: false,
      priority: 0,
      staffCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })

    act(() => { result.current.cloneFromTemplate(template) })
    expect(result.current.form.permissions).toEqual(['invoicing.view', 'inventory.view', 'payments.view'])
  })

  it('validate fails with empty name', () => {
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })
    act(() => { result.current.handleSubmit() })
    expect(result.current.errors.name).toBe('Role name is required')
  })

  it('validate fails with no permissions', () => {
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })
    act(() => { result.current.updateField('name', 'Admin') })
    act(() => { result.current.handleSubmit() })
    expect(result.current.errors.permissions).toBe('Select at least one permission')
  })

  it('handleSubmit creates role on valid form', async () => {
    mockCreateRole.mockResolvedValue({})
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })

    act(() => { result.current.updateField('name', 'Admin') })
    act(() => { result.current.togglePermission('invoicing.view') })

    await act(async () => { await result.current.handleSubmit() })

    expect(mockCreateRole).toHaveBeenCalledWith(BIZ_ID, expect.objectContaining({
      name: 'Admin',
      permissions: ['invoicing.view'],
    }))
    expect(mockToast.success).toHaveBeenCalledWith('Role created')
    expect(mockNavigate).toHaveBeenCalled()
  })

  it('handleSubmit updates role in edit mode', async () => {
    mockUpdateRole.mockResolvedValue({})
    const role = {
      id: 'role-1',
      name: 'Staff',
      description: null,
      permissions: ['invoicing.view'],
      isSystem: false,
      isDefault: false,
      priority: 2,
      staffCount: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const { result } = renderHook(
      () => useRoleBuilder({ businessId: BIZ_ID, role }),
      { wrapper },
    )

    await act(async () => { await result.current.handleSubmit() })

    expect(mockUpdateRole).toHaveBeenCalledWith(BIZ_ID, 'role-1', expect.anything())
    expect(mockToast.success).toHaveBeenCalledWith('Role updated')
  })

  it('handleSubmit shows error toast on failure', async () => {
    mockCreateRole.mockRejectedValue(new Error('Network'))
    const { result } = renderHook(() => useRoleBuilder({ businessId: BIZ_ID }), { wrapper })

    act(() => { result.current.updateField('name', 'Admin') })
    act(() => { result.current.togglePermission('invoicing.view') })

    await act(async () => { await result.current.handleSubmit() })

    expect(mockToast.error).toHaveBeenCalledWith('Failed to save role. Please try again.')
  })
})
