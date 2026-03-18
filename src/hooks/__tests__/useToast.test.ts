import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useToastStore } from '../useToast'

describe('useToastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Reset store between tests
    useToastStore.getState().clearAll()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with empty toasts', () => {
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('adds a toast', () => {
    useToastStore.getState().addToast({ type: 'success', message: 'Saved!' })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0].message).toBe('Saved!')
    expect(useToastStore.getState().toasts[0].type).toBe('success')
  })

  it('removes a toast by ID', () => {
    useToastStore.getState().addToast({ type: 'info', message: 'Test' })
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().removeToast(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('auto-removes toast after duration', () => {
    useToastStore.getState().addToast({ type: 'success', message: 'Auto' })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('deduplicates same type + message within window', () => {
    useToastStore.getState().addToast({ type: 'error', message: 'Fail' })
    useToastStore.getState().addToast({ type: 'error', message: 'Fail' })
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('allows same message after dedup window', () => {
    useToastStore.getState().addToast({ type: 'error', message: 'Fail' })
    vi.advanceTimersByTime(3001)
    useToastStore.getState().addToast({ type: 'error', message: 'Fail' })
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })

  it('evicts oldest when at max (3)', () => {
    useToastStore.getState().addToast({ type: 'info', message: 'One' })
    useToastStore.getState().addToast({ type: 'info', message: 'Two' })
    useToastStore.getState().addToast({ type: 'info', message: 'Three' })
    useToastStore.getState().addToast({ type: 'info', message: 'Four' })
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(3)
    expect(toasts.find((t) => t.message === 'One')).toBeUndefined()
    expect(toasts.find((t) => t.message === 'Four')).toBeTruthy()
  })

  it('clears all toasts', () => {
    useToastStore.getState().addToast({ type: 'info', message: 'A' })
    useToastStore.getState().addToast({ type: 'success', message: 'B' })
    useToastStore.getState().clearAll()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('supports different types for same message', () => {
    useToastStore.getState().addToast({ type: 'success', message: 'Done' })
    useToastStore.getState().addToast({ type: 'error', message: 'Done' })
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })
})
