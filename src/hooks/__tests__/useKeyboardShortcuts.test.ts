import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { CALCULATOR_TOGGLE_EVENT } from '@/config/events.config'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

function press(init: KeyboardEventInit): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { ...init, cancelable: true, bubbles: true })
  window.dispatchEvent(e)
  return e
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    navigate.mockClear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('navigates on alt+digit navigation shortcuts', () => {
    renderHook(() => useKeyboardShortcuts())
    press({ key: '1', altKey: true })
    expect(navigate).toHaveBeenCalledWith('/dashboard')
    press({ key: '2', altKey: true })
    expect(navigate).toHaveBeenCalledWith('/invoices')
  })

  it('navigates to new invoice on ctrl+n and prevents the browser default', () => {
    renderHook(() => useKeyboardShortcuts())
    const e = press({ key: 'n', ctrlKey: true })
    expect(navigate).toHaveBeenCalledWith('/invoices/new')
    expect(e.defaultPrevented).toBe(true)
  })

  it('treats meta (cmd) as ctrl for mac users', () => {
    renderHook(() => useKeyboardShortcuts())
    press({ key: 'n', metaKey: true })
    expect(navigate).toHaveBeenCalledWith('/invoices/new')
  })

  it('dispatches the calculator toggle event on ctrl+.', () => {
    const listener = vi.fn()
    window.addEventListener(CALCULATOR_TOGGLE_EVENT, listener)
    renderHook(() => useKeyboardShortcuts())
    press({ key: '.', ctrlKey: true })
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(CALCULATOR_TOGGLE_EVENT, listener)
  })

  it('ignores bare keypresses without a modifier', () => {
    renderHook(() => useKeyboardShortcuts())
    press({ key: '1' })
    press({ key: 'Enter' })
    press({ key: 'Escape' })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not attach the listener when disabled', () => {
    renderHook(() => useKeyboardShortcuts(false))
    press({ key: '1', altKey: true })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('detaches the listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    unmount()
    press({ key: '1', altKey: true })
    expect(navigate).not.toHaveBeenCalled()
  })
})
