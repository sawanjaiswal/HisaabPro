import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockCreateParty = vi.fn()
const mockUpdateParty = vi.fn()
vi.mock('../party.service', () => ({
  createParty: (...args: unknown[]) => mockCreateParty(...args),
  updateParty: (...args: unknown[]) => mockUpdateParty(...args),
}))

vi.mock('../useGstinVerify', () => ({
  useGstinVerify: () => ({
    status: 'idle',
    result: null,
    error: null,
    onGstinChange: vi.fn(),
  }),
}))

import { usePartyForm } from '../usePartyForm'

const wrapper = ({ children }: { children: ReactNode }) =>
  MemoryRouter({ children })

describe('usePartyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Initial state defaults
  it('returns correct initial state', () => {
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    expect(result.current.form).toEqual({
      name: '',
      type: 'CUSTOMER',
      tags: [],
      creditLimit: 0,
      creditLimitMode: 'WARN',
      addresses: [],
    })
    expect(result.current.errors).toEqual({})
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isEditMode).toBe(false)
    expect(result.current.activeSection).toBe('basic')
  })

  // 2. updateField updates form and clears field error
  it('updates a field and clears its error', () => {
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    // Trigger a validation error for name first
    act(() => {
      result.current.validate()
    })
    expect(result.current.errors.name).toBeTruthy()

    // Update name — error should clear
    act(() => {
      result.current.updateField('name', 'Raju Traders')
    })
    expect(result.current.form.name).toBe('Raju Traders')
    expect(result.current.errors.name).toBeUndefined()
  })

  // 3. Validation rules
  describe('validate', () => {
    it('requires name', () => {
      const { result } = renderHook(() => usePartyForm(), { wrapper })

      act(() => {
        result.current.validate()
      })
      expect(result.current.errors.name).toBe('Party name is required')
    })

    it('requires name min 2 chars', () => {
      const { result } = renderHook(() => usePartyForm(), { wrapper })

      act(() => {
        result.current.updateField('name', 'A')
      })
      act(() => {
        result.current.validate()
      })
      expect(result.current.errors.name).toBe(
        'Name must be at least 2 characters',
      )
    })

    it('rejects invalid phone', () => {
      const { result } = renderHook(() => usePartyForm(), { wrapper })

      act(() => {
        result.current.updateField('name', 'Valid Name')
        result.current.updateField('phone', '12345')
      })
      act(() => {
        result.current.validate()
      })
      expect(result.current.errors.phone).toBe(
        'Enter a valid 10-digit Indian mobile number',
      )
    })

    it('rejects invalid email', () => {
      const { result } = renderHook(() => usePartyForm(), { wrapper })

      act(() => {
        result.current.updateField('name', 'Valid Name')
        result.current.updateField('email', 'not-an-email')
      })
      act(() => {
        result.current.validate()
      })
      expect(result.current.errors.email).toBe('Enter a valid email address')
    })

    it('rejects invalid gstin', () => {
      const { result } = renderHook(() => usePartyForm(), { wrapper })

      act(() => {
        result.current.updateField('name', 'Valid Name')
        result.current.updateField('gstin', 'INVALID')
      })
      act(() => {
        result.current.validate()
      })
      expect(result.current.errors.gstin).toBe(
        'Enter a valid 15-character GSTIN',
      )
    })

    it('rejects negative credit limit', () => {
      const { result } = renderHook(() => usePartyForm(), { wrapper })

      act(() => {
        result.current.updateField('name', 'Valid Name')
        result.current.updateField('creditLimit', -100)
      })
      act(() => {
        result.current.validate()
      })
      expect(result.current.errors.creditLimit).toBe(
        'Credit limit cannot be negative',
      )
    })

    it('passes with valid form', () => {
      const { result } = renderHook(() => usePartyForm(), { wrapper })

      act(() => {
        result.current.updateField('name', 'Raju Traders')
        result.current.updateField('phone', '9876543210')
        result.current.updateField('email', 'raju@test.com')
      })

      let isValid = false
      act(() => {
        isValid = result.current.validate()
      })
      expect(isValid).toBe(true)
      expect(result.current.errors).toEqual({})
    })
  })

  // 4. Reset returns to initial form
  it('resets form to initial state', () => {
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    act(() => {
      result.current.updateField('name', 'Changed')
      result.current.setActiveSection('credit')
    })
    act(() => {
      result.current.reset()
    })

    expect(result.current.form.name).toBe('')
    expect(result.current.activeSection).toBe('basic')
    expect(result.current.errors).toEqual({})
  })

  // 5. setActiveSection
  it('updates active section', () => {
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    act(() => {
      result.current.setActiveSection('business')
    })
    expect(result.current.activeSection).toBe('business')
  })

  // 6. isEditMode derived from options
  it('sets isEditMode when editId is provided', () => {
    const { result } = renderHook(
      () => usePartyForm({ editId: 'party-123' }),
      { wrapper },
    )
    expect(result.current.isEditMode).toBe(true)
  })

  // handleSubmit tests: see usePartyForm.submit.test.ts
})
