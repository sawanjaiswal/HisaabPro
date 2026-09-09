import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { OFFLINE_MOCK } from '@/lib/playstore-mock'
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
      if (isNativeGoogleAvailable()) {
        let clientId: string | undefined
        let nonce: string | undefined
        let sealedTx: string | undefined

        if (!OFFLINE_MOCK) {
          try {
            const startRes = await startNativeSso('google')
            clientId = startRes.clientId
            nonce = startRes.nonce
            sealedTx = startRes.sealedTx
          } catch {
            // Backend offline or mock fallback
          }
        }

        const outcome = await nativeGoogleSignIn({ clientId, nonce })

        if (outcome.kind === 'cancelled') {
          setState('idle')
          return
        }

        if (outcome.kind === 'unavailable') {
          // If native account manager unavailable, mock or toast fallback
          if (!OFFLINE_MOCK) {
            setErrorCode('SSO_UNAVAILABLE')
            setState('error')
            toast.error('Google Play Services unavailable')
            return
          }
        }

        if (outcome.kind === 'failed' && !OFFLINE_MOCK) {
          setErrorCode('SSO_TOKEN_INVALID')
          setState('error')
          toast.error((t as any).loginFailed ?? 'Google Sign-In failed')
          return
        }

        const idToken = outcome.kind === 'ok' ? outcome.idToken : 'mock-google-id-token'
        const response = await exchangeNativeSso('google', { idToken, sealedTx, nonce })

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

      // Web / Non-Android environment or OFFLINE_MOCK
      const response = await exchangeNativeSso('google', { idToken: 'mock-google-web-token' })
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
