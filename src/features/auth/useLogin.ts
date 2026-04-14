/** Login hook -- mutation only (TanStack Query) */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../lib/api'
import * as authLib from '../../lib/auth'
import { useBiometric } from '../../hooks/useBiometric'
import { ROUTES } from '../../config/routes.config'

export function useLogin() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')

  const navigate = useNavigate()
  const { setUser, setBusinesses } = useAuth()
  const { isSupported: biometricSupported, isRegistered: biometricRegistered, checking: biometricChecking, authenticate } = useBiometric()

  const mutation = useMutation({
    mutationFn: ({ id, pass, captcha }: { id: string; pass: string; captcha?: string }) =>
      authLib.login(id, pass, captcha),
    onSuccess: (result) => {
      authLib.setCachedUser(result.user)
      authLib.setCachedBusinesses(result.businesses)
      setUser(result.user)
      setBusinesses(result.businesses)
      navigate(result.isNewUser ? ROUTES.ONBOARDING : ROUTES.DASHBOARD, { replace: true })
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true)
        setError('Please complete the CAPTCHA below to continue.')
      } else {
        setError(err instanceof Error ? err.message : 'Login failed')
      }
    },
  })

  const handleSetIdentifier = useCallback((value: string) => {
    setIdentifier(value)
    setCaptchaToken('')
  }, [])

  const handleSetPassword = useCallback((value: string) => {
    setPassword(value)
    setCaptchaToken('')
  }, [])

  const handleLogin = useCallback(async () => {
    if (mutation.isPending) return
    setError('')
    mutation.mutate({ id: identifier, pass: password, captcha: captchaToken || undefined })
  }, [identifier, password, captchaToken, mutation])

  const [biometricLoading, setBiometricLoading] = useState(false)

  const handleBiometric = useCallback(async () => {
    if (biometricLoading) return
    setBiometricLoading(true)
    setError('')
    try {
      const result = await authenticate()
      if (result.success) {
        // Biometric auth sets cookies — refresh user from server
        const me = await authLib.getMe()
        authLib.setCachedUser(me.user)
        authLib.setCachedBusinesses(me.businesses)
        setUser(me.user)
        setBusinesses(me.businesses)
        navigate(ROUTES.DASHBOARD, { replace: true })
      } else {
        setError('Biometric authentication failed. Please use your password.')
      }
    } catch {
      setError('Biometric authentication failed.')
    } finally {
      setBiometricLoading(false)
    }
  }, [authenticate, biometricLoading, navigate, setUser, setBusinesses])

  const showBiometric = !biometricChecking && biometricSupported && biometricRegistered

  return {
    identifier, setIdentifier: handleSetIdentifier,
    password, setPassword: handleSetPassword,
    loading: mutation.isPending, error,
    captchaRequired, captchaToken, setCaptchaToken,
    handleLogin,
    showBiometric, biometricLoading, handleBiometric,
    // backward-compat aliases used in LoginPage
    username: identifier, setUsername: handleSetIdentifier,
  }
}
