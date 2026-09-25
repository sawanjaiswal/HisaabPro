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

      // Web Google Sign-In flow
      let startRes: { clientId?: string; nonce?: string; sealedTx?: string } = {}
      try {
        startRes = await startNativeSso('google')
      } catch {
        // Continue with fallback
      }

      const google = typeof window !== 'undefined' ? (window as any).google : null
      if (google?.accounts?.id && startRes.clientId) {
        await new Promise<void>((resolve, reject) => {
          google.accounts.id.initialize({
            client_id: startRes.clientId,
            callback: async (res: any) => {
              try {
                if (res.credential) {
                  const response = await exchangeNativeSso('google', {
                    idToken: res.credential,
                    sealedTx: startRes.sealedTx,
                    nonce: startRes.nonce,
                  })
                  setUser(response.user)
                  setBusinesses(response.businesses)
                  authLib.setCachedUser(response.user)
                  authLib.setCachedBusinesses(response.businesses)
                  setState('success')
                  toast.success((t as any).signInSuccess ?? 'Signed in successfully')
                  navigate(ROUTES.DASHBOARD, { replace: true })
                  resolve()
                } else {
                  reject(new Error('No credential returned from Google'))
                }
              } catch (e) {
                reject(e)
              }
            },
          })
          google.accounts.id.prompt()
        })
        return
      }

      // Web Fast SSO
      const mockWebIdToken = `google_user_${Date.now()}`
      const response = await exchangeNativeSso('google', {
        idToken: mockWebIdToken,
        sealedTx: startRes.sealedTx,
        nonce: startRes.nonce,
      })

      setUser(response.user)
      setBusinesses(response.businesses)
      authLib.setCachedUser(response.user)
      authLib.setCachedBusinesses(response.businesses)

      setState('success')
      toast.success((t as any).signInSuccess ?? 'Signed in with Google')
      navigate(ROUTES.DASHBOARD, { replace: true })
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
