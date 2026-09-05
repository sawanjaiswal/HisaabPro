import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { ROUTES } from '@/config/routes.config'

/**
 * Handles Android physical/gesture back button via Capacitor App plugin.
 * Pops React Router history stack gracefully instead of killing the app webview.
 */
export function useHardwareBackButton(enabled = true): void {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return

    const listenerPromise = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const isRoot =
        location.pathname === ROUTES.DASHBOARD ||
        location.pathname === ROUTES.LOGIN ||
        location.pathname === ROUTES.HOME

      if (isRoot) {
        CapacitorApp.exitApp()
      } else if (canGoBack || window.history.length > 1) {
        navigate(-1)
      } else {
        navigate(ROUTES.DASHBOARD, { replace: true })
      }
    })

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {})
    }
  }, [enabled, navigate, location.pathname])
}
