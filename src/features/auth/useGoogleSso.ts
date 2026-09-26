import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { isNativeGoogleAvailable, nativeGoogleSignIn } from './native-google-signin'
import { startNativeSso, exchangeNativeSso } from './sso.api'
import type { SsoErrorCode, SsoState } from './sso.types'
import * as authLib from '@/lib/auth'

export interface UseGoogleSsoReturn {
  state: SsoState
  loading: boolean
  errorCode: SsoErrorCode | null
  startGoogleSignIn: () => Promise<void>
}

async function loadGoogleGsiScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if ((window as any).google?.accounts?.oauth2) return true

  return new Promise((resolve) => {
    const existing = document.getElementById('google-gsi-client')
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'google-gsi-client'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

export function useGoogleSso(): UseGoogleSsoReturn {
  const [state, setState] = useState<SsoState>('idle')
  const [errorCode, setErrorCode] = useState<SsoErrorCode | null>(null)
  const { setUser, setBusinesses } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()

  const startGoogleSignIn = useCallback(async () => {
    setErrorCode(null)
    setState('authenticating')

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
          // Continue
        }

        const outcome = await nativeGoogleSignIn({ clientId, nonce })

        if (outcome.kind === 'cancelled') {
          setState('idle')
          return
        }

        if (outcome.kind === 'unavailable') {
          setErrorCode('SSO_UNAVAILABLE')
          setState('error')
          toast.error('Google Play Services unavailable on this device')
          return
        }

        if (outcome.kind === 'failed' || !outcome.idToken) {
          setErrorCode('SSO_TOKEN_INVALID')
          setState('error')
          toast.error((t as any).loginFailed ?? 'Google Sign-In failed')
          return
        }

        const response = await exchangeNativeSso('google', { idToken: outcome.idToken, sealedTx, nonce })

        setUser(response.user)
        setBusinesses(response.businesses)
        authLib.setCachedUser(response.user)
        authLib.setCachedBusinesses(response.businesses)

        setState('success')
        toast.success((t as any).signInSuccess ?? 'Signed in successfully')

        if (response.businesses.length === 0) {
          navigate(ROUTES.ONBOARDING, { replace: true })
        } else {
          navigate(ROUTES.DASHBOARD, { replace: true })
        }
        return
      }

      // 2. Web Google OAuth 2.0 Account Picker Flow
      let startRes: { clientId?: string; nonce?: string; sealedTx?: string } = {}
      try {
        startRes = await startNativeSso('google')
      } catch {
        // Continue
      }

      const clientId = startRes.clientId || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID

      if (!clientId) {
        setState('idle')
        toast.error('Google Sign-In requires GOOGLE_CLIENT_ID configured on the server. Please sign in with Email.')
        return
      }

      const gsiLoaded = await loadGoogleGsiScript()
      const google = typeof window !== 'undefined' ? (window as any).google : null

      if (!gsiLoaded || !google?.accounts?.oauth2) {
        setState('error')
        toast.error('Could not load Google Sign-In service. Please check your connection or use Email.')
        return
      }

      // Open Google Account Picker Dialog Window
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setState('idle')
            if (tokenResponse.error !== 'user_cancel' && tokenResponse.error !== 'popup_closed') {
              toast.error(`Google Sign-In: ${tokenResponse.error_description || tokenResponse.error}`)
            }
            return
          }

          if (!tokenResponse.access_token) {
            setState('error')
            toast.error('No authorization token received from Google')
            return
          }

          try {
            const response = await exchangeNativeSso('google', {
              accessToken: tokenResponse.access_token,
              sealedTx: startRes.sealedTx,
              nonce: startRes.nonce,
            })

            setUser(response.user)
            setBusinesses(response.businesses)
            authLib.setCachedUser(response.user)
            authLib.setCachedBusinesses(response.businesses)

            setState('success')
            toast.success((t as any).signInSuccess ?? 'Signed in with Google')

            if (response.businesses.length === 0) {
              navigate(ROUTES.ONBOARDING, { replace: true })
            } else {
              navigate(ROUTES.DASHBOARD, { replace: true })
            }
          } catch (err: any) {
            setErrorCode('SSO_EXCHANGE_FAILED')
            setState('error')
            toast.error(err?.message || 'Google account verification failed')
          }
        },
      })

      tokenClient.requestAccessToken({ prompt: 'select_account' })
    } catch {
      setErrorCode('SSO_EXCHANGE_FAILED')
      setState('error')
      toast.error((t as any).loginFailed ?? 'Failed to sign in with Google')
    }
  }, [setUser, setBusinesses, navigate, toast, t])

  return {
    state,
    loading: state === 'authenticating',
    errorCode,
    startGoogleSignIn,
  }
}
