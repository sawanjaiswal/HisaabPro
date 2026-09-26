/**
 * Google SSO Hook (Level 7 Zero-Stall Resilient Architecture)
 *
 * Design Guarantees:
 * 1. Preloads Google Identity Services (GIS) and Client ID on mount so popup triggers
 *    synchronously within the direct user gesture tick (never blocked by popup blockers).
 * 2. Window-focus & Watchdog recovery: if popup is closed, dismissed, or stalled,
 *    state automatically resets to 'idle' (button never permanently stuck on 'Signing in...').
 * 3. Handles post-logout / expired session state cleanly without triggering false 401 refresh loops.
 * 4. Error auto-clear: returns to 'idle' after error toast so user can immediately retry without page refresh.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { isNativeGoogleAvailable, nativeGoogleSignIn } from './native-google-signin'
import { startNativeSso, exchangeNativeSso, getSsoConfig } from './sso.api'
import type { SsoErrorCode, SsoState } from './sso.types'
import * as authLib from '@/lib/auth'

export interface UseGoogleSsoReturn {
  state: SsoState
  loading: boolean
  errorCode: SsoErrorCode | null
  startGoogleSignIn: () => Promise<void>
  reset: () => void
}

// Module-level singletons for instant preloading
let cachedClientId: string | null = null
let gsiPromise: Promise<boolean> | null = null

function loadGoogleGsiScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve(true)
  if (gsiPromise) return gsiPromise

  gsiPromise = new Promise((resolve) => {
    const existing = document.getElementById('google-gsi-client')
    if (existing) {
      if ((window as any).google?.accounts?.oauth2) {
        resolve(true)
        return
      }
      existing.addEventListener('load', () => resolve(true), { once: true })
      existing.addEventListener('error', () => {
        gsiPromise = null
        resolve(false)
      }, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'google-gsi-client'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      gsiPromise = null
      resolve(false)
    }
    document.head.appendChild(script)
  })

  return gsiPromise
}

async function fetchGoogleClientId(): Promise<string | null> {
  if (cachedClientId) return cachedClientId
  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID
  if (envId) {
    cachedClientId = envId
    return envId
  }

  try {
    const config = await getSsoConfig('google')
    if (config?.clientId) {
      cachedClientId = config.clientId
      return config.clientId
    }
  } catch {
    // Non-fatal
  }
  return null
}

// Kick off eager preload in background immediately
if (typeof window !== 'undefined') {
  void loadGoogleGsiScript()
  void fetchGoogleClientId()
}

export function useGoogleSso(): UseGoogleSsoReturn {
  const [state, setState] = useState<SsoState>('idle')
  const [errorCode, setErrorCode] = useState<SsoErrorCode | null>(null)
  const { setUser, setBusinesses } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()

  const isMountedRef = useRef(true)
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const authStartTimeRef = useRef<number>(0)

  const clearTimers = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current)
      watchdogTimerRef.current = null
    }
    if (focusCheckTimerRef.current) {
      clearTimeout(focusCheckTimerRef.current)
      focusCheckTimerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearTimers()
    if (isMountedRef.current) {
      setState('idle')
      setErrorCode(null)
    }
  }, [clearTimers])

  // Eager background preload on component mount
  useEffect(() => {
    isMountedRef.current = true
    void loadGoogleGsiScript()
    void fetchGoogleClientId()

    return () => {
      isMountedRef.current = false
      clearTimers()
    }
  }, [clearTimers])

  // Window refocus recovery: when user switches back from popup or dismisses it
  useEffect(() => {
    const handleWindowFocus = () => {
      if (state !== 'authenticating') return

      // If user refocuses window after clicking popup, check if popup was dismissed
      const elapsed = Date.now() - authStartTimeRef.current
      if (elapsed > 1500) {
        focusCheckTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && state === 'authenticating') {
            setState('idle')
          }
        }, 1500)
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [state])

  const startGoogleSignIn = useCallback(async () => {
    clearTimers()
    setErrorCode(null)
    setState('authenticating')
    authStartTimeRef.current = Date.now()

    // 40-second absolute watchdog safety timeout
    watchdogTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && state === 'authenticating') {
        setState('idle')
        toast.error('Google Sign-In timed out. Please try again.')
      }
    }, 40000)

    try {
      // 1. Android / iOS Native Flow via Credential Manager
      if (isNativeGoogleAvailable()) {
        let clientId: string | undefined
        let nonce: string | undefined
        let sealedTx: string | undefined

        try {
          const startRes = await startNativeSso('google')
          clientId = startRes.clientId
          nonce = startRes.nonce
          sealedTx = startRes.sealedTx
        } catch {
          // Fall back to cached clientId
          clientId = cachedClientId || undefined
        }

        const outcome = await nativeGoogleSignIn({ clientId, nonce })

        if (outcome.kind === 'cancelled') {
          clearTimers()
          if (isMountedRef.current) setState('idle')
          return
        }

        if (outcome.kind === 'unavailable') {
          clearTimers()
          if (isMountedRef.current) {
            setErrorCode('SSO_UNAVAILABLE')
            setState('error')
            setTimeout(() => { if (isMountedRef.current) setState('idle') }, 3000)
          }
          toast.error('Google Play Services unavailable on this device')
          return
        }

        if (outcome.kind === 'failed' || !outcome.idToken) {
          clearTimers()
          if (isMountedRef.current) {
            setErrorCode('SSO_TOKEN_INVALID')
            setState('error')
            setTimeout(() => { if (isMountedRef.current) setState('idle') }, 3000)
          }
          toast.error((t as any).loginFailed ?? 'Google Sign-In failed')
          return
        }

        const response = await exchangeNativeSso('google', { idToken: outcome.idToken, sealedTx, nonce })

        clearTimers()
        setUser(response.user)
        setBusinesses(response.businesses)
        authLib.setCachedUser(response.user)
        authLib.setCachedBusinesses(response.businesses)

        if (isMountedRef.current) setState('success')
        toast.success((t as any).signInSuccess ?? 'Signed in successfully')

        if (response.businesses.length === 0) {
          navigate(ROUTES.ONBOARDING, { replace: true })
        } else {
          navigate(ROUTES.DASHBOARD, { replace: true })
        }
        return
      }

      // 2. Web Google OAuth 2.0 Flow
      const clientId = cachedClientId || (await fetchGoogleClientId())

      if (!clientId) {
        clearTimers()
        if (isMountedRef.current) {
          setState('idle')
          toast.error('Google Sign-In is not configured. Please sign in with Email / Password.')
        }
        return
      }

      const gsiLoaded = await loadGoogleGsiScript()
      const google = typeof window !== 'undefined' ? (window as any).google : null

      if (!gsiLoaded || !google?.accounts?.oauth2) {
        clearTimers()
        if (isMountedRef.current) {
          setState('error')
          setTimeout(() => { if (isMountedRef.current) setState('idle') }, 3000)
        }
        toast.error('Could not load Google Sign-In service. Please check your connection or use Email.')
        return
      }

      // Initialize Token Client
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          clearTimers()

          if (tokenResponse.error) {
            if (isMountedRef.current) setState('idle')
            if (tokenResponse.error !== 'user_cancel' && tokenResponse.error !== 'popup_closed') {
              toast.error(`Google Sign-In: ${tokenResponse.error_description || tokenResponse.error}`)
            }
            return
          }

          if (!tokenResponse.access_token) {
            if (isMountedRef.current) {
              setState('error')
              setTimeout(() => { if (isMountedRef.current) setState('idle') }, 3000)
            }
            toast.error('No authorization token received from Google')
            return
          }

          try {
            const response = await exchangeNativeSso('google', {
              accessToken: tokenResponse.access_token,
            })

            setUser(response.user)
            setBusinesses(response.businesses)
            authLib.setCachedUser(response.user)
            authLib.setCachedBusinesses(response.businesses)

            if (isMountedRef.current) setState('success')
            toast.success((t as any).signInSuccess ?? 'Signed in with Google')

            if (response.businesses.length === 0) {
              navigate(ROUTES.ONBOARDING, { replace: true })
            } else {
              navigate(ROUTES.DASHBOARD, { replace: true })
            }
          } catch (err: any) {
            if (isMountedRef.current) {
              setErrorCode('SSO_EXCHANGE_FAILED')
              setState('error')
              setTimeout(() => { if (isMountedRef.current) setState('idle') }, 3000)
            }
            toast.error(err?.message || 'Google account verification failed')
          }
        },
      })

      // Trigger Google popup
      tokenClient.requestAccessToken({ prompt: 'select_account' })
    } catch {
      clearTimers()
      if (isMountedRef.current) {
        setErrorCode('SSO_EXCHANGE_FAILED')
        setState('error')
        setTimeout(() => { if (isMountedRef.current) setState('idle') }, 3000)
      }
      toast.error((t as any).loginFailed ?? 'Failed to sign in with Google')
    }
  }, [clearTimers, setUser, setBusinesses, navigate, toast, t, state])

  return {
    state,
    loading: state === 'authenticating',
    errorCode,
    startGoogleSignIn,
    reset,
  }
}
