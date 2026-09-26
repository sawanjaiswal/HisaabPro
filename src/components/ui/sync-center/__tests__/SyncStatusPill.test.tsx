import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SyncStatusPill } from '../SyncStatusPill'
import { SyncManager } from '@/sync/SyncManager'

vi.mock('@/sync/SyncManager', () => {
  let currentState = { status: 'SYNCED', pendingCount: 0 }
  let listener: ((s: any) => void) | null = null

  return {
    SyncManager: {
      getState: vi.fn(() => currentState),
      subscribe: vi.fn((cb) => {
        listener = cb
        return () => { listener = null }
      }),
      triggerSync: vi.fn(),
      __setState: (s: any) => {
        currentState = s
        if (listener) listener(s)
      },
    },
  }
})

describe('SyncStatusPill minimal icon button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(SyncManager as any).__setState({ status: 'SYNCED', pendingCount: 0 })
  })

  it('renders minimal icon button with synced aria-label and triggers sync on click', () => {
    render(<SyncStatusPill />)

    const button = screen.getByRole('button', { name: /synced with cloud/i })
    expect(button).toBeInTheDocument()

    // No text label displayed in minimal icon mode
    expect(screen.queryByText('Synced')).not.toBeInTheDocument()

    fireEvent.click(button)
    expect(SyncManager.triggerSync).toHaveBeenCalledTimes(1)
  })

  it('displays pending count badge when pendingCount > 0', () => {
    ;(SyncManager as any).__setState({ status: 'SYNCED', pendingCount: 3 })
    render(<SyncStatusPill />)

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3 pending changes/i })).toBeInTheDocument()
  })

  it('displays offline state correctly', () => {
    ;(SyncManager as any).__setState({ status: 'OFFLINE', pendingCount: 0 })
    render(<SyncStatusPill />)

    expect(screen.getByRole('button', { name: /offline/i })).toBeInTheDocument()
  })

  it('displays syncing state correctly', () => {
    ;(SyncManager as any).__setState({ status: 'SYNCING', pendingCount: 2 })
    render(<SyncStatusPill />)

    expect(screen.getByRole('button', { name: /syncing/i })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
