import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { resolveParentRoute } from '../topology'
import { flowOverlayManager } from '../flowEngine'
import { useFlowEngine } from '../useFlowEngine'
import { ROUTES } from '@/config/routes.config'

const mockNavigate = vi.fn()
let mockLocation = {
  pathname: '/parties/123',
  search: '',
  state: null as any,
}

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

describe('Level 6 Navigation System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation = {
      pathname: '/parties/123',
      search: '',
      state: null,
    }
  })

  describe('Route Topology & Parent Resolution', () => {
    it('resolves exact match parent routes', () => {
      expect(resolveParentRoute(ROUTES.PARTY_NEW)).toBe(ROUTES.PARTIES)
      expect(resolveParentRoute(ROUTES.INVOICE_CREATE)).toBe(ROUTES.INVOICES)
      expect(resolveParentRoute(ROUTES.PAYMENT_NEW)).toBe(ROUTES.PAYMENTS)
      expect(resolveParentRoute(ROUTES.PARTIES)).toBe(ROUTES.DASHBOARD)
      expect(resolveParentRoute(ROUTES.REPORTS)).toBe(ROUTES.DASHBOARD)
    })

    it('resolves parameterized and nested entity routes', () => {
      expect(resolveParentRoute('/parties/p_123/edit')).toBe('/parties/p_123')
      expect(resolveParentRoute('/parties/p_123')).toBe(ROUTES.PARTIES)
      expect(resolveParentRoute('/invoices/inv_456/edit')).toBe('/invoices/inv_456')
      expect(resolveParentRoute('/invoices/inv_456')).toBe(ROUTES.INVOICES)
      expect(resolveParentRoute('/payments/pay_789/edit')).toBe('/payments/pay_789')
      expect(resolveParentRoute('/payments/pay_789')).toBe(ROUTES.PAYMENTS)
    })

    it('falls back to default dashboard for unknown routes', () => {
      expect(resolveParentRoute('/unknown/path')).toBe(ROUTES.DASHBOARD)
    })
  })

  describe('Flow Overlay Manager (TaskFrames / Sheets)', () => {
    it('manages overlay registration and dismissal in LIFO order', () => {
      const dismiss1 = vi.fn()
      const dismiss2 = vi.fn()

      const unregister1 = flowOverlayManager.registerOverlay(dismiss1)
      const unregister2 = flowOverlayManager.registerOverlay(dismiss2)

      expect(flowOverlayManager.activeOverlayCount).toBe(2)

      // Top overlay (dismiss2) should be handled first
      const handled = flowOverlayManager.handleOverlayBack()
      expect(handled).toBe(true)
      expect(dismiss2).toHaveBeenCalledTimes(1)
      expect(dismiss1).not.toHaveBeenCalled()
      expect(flowOverlayManager.activeOverlayCount).toBe(1)

      // Clean up
      unregister1()
      unregister2()
    })

    it('tracks dirty form guards', () => {
      const guard = vi.fn(() => true)
      const unregister = flowOverlayManager.registerDirtyGuard(guard)

      expect(flowOverlayManager.isAnyFormDirty()).toBe(true)
      expect(guard).toHaveBeenCalled()

      unregister()
      expect(flowOverlayManager.isAnyFormDirty()).toBe(false)
    })
  })

  describe('useFlowEngine', () => {
    it('goBack prioritizes active overlays over routing', () => {
      const dismiss = vi.fn()
      const unregister = flowOverlayManager.registerOverlay(dismiss)

      const { result } = renderHook(() => useFlowEngine())
      act(() => {
        result.current.goBack()
      })

      expect(dismiss).toHaveBeenCalledTimes(1)
      expect(mockNavigate).not.toHaveBeenCalled()

      unregister()
    })

    it('goBack prioritizes explicit returnTo state with replace: true', () => {
      mockLocation = {
        pathname: '/invoices/new',
        search: '?partyId=p_123',
        state: { returnTo: '/parties/p_123' },
      }

      const { result } = renderHook(() => useFlowEngine())
      act(() => {
        result.current.goBack()
      })

      expect(mockNavigate).toHaveBeenCalledWith('/parties/p_123', { replace: true })
    })

    it('goBack falls back to topology parent when no history or returnTo', () => {
      mockLocation = {
        pathname: '/invoices/inv_999',
        search: '',
        state: null,
      }
      // window.history.state has no idx
      window.history.replaceState(null, '')

      const { result } = renderHook(() => useFlowEngine())
      act(() => {
        result.current.goBack()
      })

      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.INVOICES, { replace: true })
    })

    it('completeFlow purges ephemeral node with replace: true', () => {
      mockLocation = {
        pathname: '/invoices/new',
        search: '',
        state: { returnTo: '/parties/cust_10' },
      }

      const { result } = renderHook(() => useFlowEngine())
      act(() => {
        result.current.completeFlow({ terminalPath: '/invoices/inv_new_1' })
      })

      // returnTo takes precedence
      expect(mockNavigate).toHaveBeenCalledWith('/parties/cust_10', {
        replace: true,
        state: undefined,
      })
    })

    it('completeFlow falls back to terminalPath when no returnTo exists', () => {
      mockLocation = {
        pathname: '/invoices/new',
        search: '',
        state: null,
      }

      const { result } = renderHook(() => useFlowEngine())
      act(() => {
        result.current.completeFlow({ terminalPath: '/invoices/inv_new_1' })
      })

      expect(mockNavigate).toHaveBeenCalledWith('/invoices/inv_new_1', {
        replace: true,
        state: undefined,
      })
    })

    it('navigateWithContext attaches current path as returnTo', () => {
      mockLocation = {
        pathname: '/parties/p_55',
        search: '?tab=ledger',
        state: null,
      }

      const { result } = renderHook(() => useFlowEngine())
      act(() => {
        result.current.navigateWithContext('/invoices/new?partyId=p_55')
      })

      expect(mockNavigate).toHaveBeenCalledWith('/invoices/new?partyId=p_55', {
        state: {
          returnTo: '/parties/p_55?tab=ledger',
        },
      })
    })
  })
})
