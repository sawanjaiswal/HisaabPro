/**
 * Unified Flow Engine Hook
 * Level 6 Navigation Facade for all components, forms, and headers.
 */

import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { resolveParentRoute } from './topology'
import { flowOverlayManager, type GoBackOptions, type CompleteFlowOptions } from './flowEngine'

export function useFlowEngine() {
  const navigate = useNavigate()
  const location = useLocation()

  /**
   * Universal Back Action
   * Resolution hierarchy:
   * 1. If an overlay / TaskFrame / Bottom Sheet is open -> dismiss it.
   * 2. If caller passed state.returnTo -> navigate to returnTo with replace: true.
   * 3. If browser history stack has internal entries -> navigate(-1).
   * 4. Fallback -> compute canonical parent from ROUTE_TOPOLOGY.
   */
  const goBack = useCallback((options: GoBackOptions = {}) => {
    // 1. Check overlays / drawers / modal frames
    if (flowOverlayManager.handleOverlayBack()) {
      return
    }

    // 2. Check explicit caller context
    const state = location.state as { returnTo?: string } | null
    if (state?.returnTo && typeof state.returnTo === 'string') {
      navigate(state.returnTo, { replace: true })
      return
    }

    // 3. Pop internal history stack if possible
    const historyIdx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof historyIdx === 'number' && historyIdx > 0) {
      navigate(-1)
      return
    }

    // 4. Resolve topological parent route
    const fallback = options.fallbackRoute ?? resolveParentRoute(location.pathname, ROUTES.DASHBOARD)
    navigate(fallback, { replace: true })
  }, [navigate, location])

  /**
   * Universal Flow Completion
   * Atomically overwrites ephemeral creation/edit history node with the terminal destination.
   */
  const completeFlow = useCallback((options: CompleteFlowOptions = {}) => {
    const state = location.state as { returnTo?: string } | null
    const target = state?.returnTo || options.terminalPath || resolveParentRoute(location.pathname, ROUTES.DASHBOARD)

    navigate(target, {
      replace: true,
      state: options.state,
    })
  }, [navigate, location])

  /**
   * Context-Preserving Navigation
   * Automatically passes the current route as `returnTo` unless overridden.
   */
  const navigateWithContext = useCallback((target: string, customState?: Record<string, unknown>) => {
    navigate(target, {
      state: {
        returnTo: location.pathname + location.search,
        ...customState,
      },
    })
  }, [navigate, location])

  return {
    goBack,
    completeFlow,
    navigateWithContext,
    registerOverlay: flowOverlayManager.registerOverlay.bind(flowOverlayManager),
    registerDirtyGuard: flowOverlayManager.registerDirtyGuard.bind(flowOverlayManager),
  }
}
