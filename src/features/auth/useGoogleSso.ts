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

        try {
          const startRes = await startNativeSso('google')
          clientId = startRes.clientId
          nonce = startRes.nonce
          sealedTx = startRes.sealedTx
        } catch {
          // Backend or network error on start
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

      // Web fallback: guide to mobile number / password login
      toast.info('Please sign in with your mobile number or email and password.')
      setState('idle')
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
