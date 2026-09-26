import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { ROUTES } from '@/config/routes.config'
import { useFlowEngine, flowOverlayManager } from '@/lib/navigation'

/**
 * Handles Android physical/gesture back button via Capacitor App plugin.
 * Level 6 Axiom: Dispatches through the unified FlowEngine back bus.
 */
export function useHardwareBackButton(enabled = true): void {
  const { goBack } = useFlowEngine()
  const location = useLocation()

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      // 1. If an overlay / sheet is open, dismiss it and halt
      if (flowOverlayManager.handleOverlayBack()) {
        return
      }

      // 2. If at application root, exit app
      const isRoot =
        location.pathname === ROUTES.DASHBOARD ||
        location.pathname === ROUTES.LOGIN ||
        location.pathname === ROUTES.HOME

      if (isRoot) {
        CapacitorApp.exitApp()
        return
      }

      // 3. Dispatch unified back action
      goBack()
    })

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {})
    }
  }, [enabled, goBack, location.pathname])
}
