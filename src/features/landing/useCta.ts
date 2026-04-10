import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { CTA_ROUTE } from './landing.constants'

const MARKETING_HOSTS = new Set(['hisaabpro.in', 'www.hisaabpro.in'])
const APP_ORIGIN = 'https://app.hisaabpro.in'

export function isMarketingHost(): boolean {
  if (typeof window === 'undefined') return false
  return MARKETING_HOSTS.has(window.location.hostname)
}

export function ctaHref(route: string = CTA_ROUTE): string {
  if (isMarketingHost()) return `${APP_ORIGIN}${route}`
  return route
}

export function useCta() {
  const navigate = useNavigate()
  return useCallback(
    (route: string = CTA_ROUTE) => {
      if (isMarketingHost()) {
        window.location.href = `${APP_ORIGIN}${route}`
        return
      }
      navigate(route)
    },
    [navigate]
  )
}
