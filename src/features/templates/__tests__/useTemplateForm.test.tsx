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

const mockCreateTemplate = vi.fn()
const mockUpdateTemplate = vi.fn()
vi.mock('../template.service', () => ({
  createTemplate: (...args: unknown[]) => mockCreateTemplate(...args),
  updateTemplate: (...args: unknown[]) => mockUpdateTemplate(...args),
}))
vi.mock('../template.utils', () => ({
  buildDefaultConfig: () => ({ columns: {}, fields: {} }),
  buildDefaultPrintSettings: () => ({ paperSize: 'A4' }),
  validateTemplateName: (n: string) => (n.trim() ? null : 'Name is required'),
}))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))
vi.mock('@/config/routes.config', () => ({ ROUTES: { SETTINGS: '/settings' } }))

import { useTemplateForm } from '../useTemplateForm'

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('useTemplateForm', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('initializes with empty form in create mode', () => {
    const { result } = renderHook(() => useTemplateForm(), { wrapper })
    expect(result.current.form.name).toBe('')
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.activeTab).toBe('layout')
  })

  it('validate returns false for empty name', () => {
    const { result } = renderHook(() => useTemplateForm(), { wrapper })
    act(() => { expect(result.current.validate()).toBe(false) })
    expect(result.current.errors.name).toBe('Name is required')
  })

  it('updateName clears name error', () => {
    const { result } = renderHook(() => useTemplateForm(), { wrapper })
    act(() => { result.current.validate() })
    expect(result.current.errors.name).toBeDefined()
    act(() => { result.current.updateName('My Template') })
    expect(result.current.errors.name).toBeUndefined()
  })

  it('submits create and navigates', async () => {
    mockCreateTemplate.mockResolvedValue({ id: 't-1' })
    const { result } = renderHook(() => useTemplateForm(), { wrapper })
    act(() => { result.current.updateName('Invoice A') })
    await act(async () => { await result.current.handleSubmit() })
    expect(mockCreateTemplate).toHaveBeenCalled()
    expect(mockToast.success).toHaveBeenCalledWith('Invoice A created')
    expect(mockNavigate).toHaveBeenCalledWith('/settings/templates')
  })

  it('shows error toast on submit failure', async () => {
    mockCreateTemplate.mockRejectedValue(new Error('Server down'))
    const { result } = renderHook(() => useTemplateForm(), { wrapper })
    act(() => { result.current.updateName('Test') })
    await act(async () => { await result.current.handleSubmit() })
    expect(mockToast.error).toHaveBeenCalledWith('Failed to save template. Please try again.')
  })
})
