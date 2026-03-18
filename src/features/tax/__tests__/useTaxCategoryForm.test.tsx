import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
vi.mock('../tax.service', () => ({
  createTaxCategory: (...args: unknown[]) => mockCreate(...args),
  updateTaxCategory: (...args: unknown[]) => mockUpdate(...args),
}))
vi.mock('@/config/routes.config', () => ({ ROUTES: { SETTINGS_TAX_RATES: '/settings/tax-rates' } }))

import { useTaxCategoryForm } from '../useTaxCategoryForm'

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('useTaxCategoryForm', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('initializes with default empty form', () => {
    const { result } = renderHook(
      () => useTaxCategoryForm({ businessId: 'biz-1' }),
      { wrapper },
    )
    expect(result.current.form.name).toBe('')
    expect(result.current.form.rate).toBe(0)
    expect(result.current.isEdit).toBe(false)
  })

  it('validate fails for empty name', () => {
    const { result } = renderHook(
      () => useTaxCategoryForm({ businessId: 'biz-1' }),
      { wrapper },
    )
    let valid = false
    act(() => { valid = result.current.handleSubmit() as unknown as boolean })
    expect(result.current.errors.name).toBe('Name is required')
  })

  it('updateField updates form and clears error', () => {
    const { result } = renderHook(
      () => useTaxCategoryForm({ businessId: 'biz-1' }),
      { wrapper },
    )
    act(() => { result.current.updateField('name', 'GST 18%') })
    expect(result.current.form.name).toBe('GST 18%')
  })

  it('submits create and navigates on success', async () => {
    mockCreate.mockResolvedValue({ id: 'tc-1' })
    const { result } = renderHook(
      () => useTaxCategoryForm({ businessId: 'biz-1' }),
      { wrapper },
    )
    act(() => { result.current.updateField('name', 'GST 18%') })
    await act(async () => { await result.current.handleSubmit() })
    expect(mockCreate).toHaveBeenCalledWith('biz-1', expect.objectContaining({ name: 'GST 18%' }))
    expect(mockToast.success).toHaveBeenCalledWith('GST 18% created')
    expect(mockNavigate).toHaveBeenCalledWith('/settings/tax-rates')
  })

  it('submits update in edit mode', async () => {
    mockUpdate.mockResolvedValue({ id: 'tc-1' })
    const { result } = renderHook(
      () => useTaxCategoryForm({ businessId: 'biz-1', editId: 'tc-1', initialData: { name: 'Old', rate: 1800, cessRate: 0, cessType: 'PERCENTAGE', hsnCode: '', sacCode: '' } }),
      { wrapper },
    )
    act(() => { result.current.updateField('name', 'Updated') })
    await act(async () => { await result.current.handleSubmit() })
    expect(mockUpdate).toHaveBeenCalledWith('tc-1', expect.objectContaining({ name: 'Updated' }))
    expect(mockToast.success).toHaveBeenCalledWith('Updated updated')
  })

  it('shows error toast on submit failure', async () => {
    mockCreate.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(
      () => useTaxCategoryForm({ businessId: 'biz-1' }),
      { wrapper },
    )
    act(() => { result.current.updateField('name', 'Test') })
    await act(async () => { await result.current.handleSubmit() })
    expect(mockToast.error).toHaveBeenCalledWith('Failed to create')
  })
})
