/** Login hook -- mutation only (TanStack Query) */

import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../lib/api'
import * as authLib from '../../lib/auth'
import type { BusinessSummary } from './auth.types'
import { useBiometric } from '../../hooks/useBiometric'
import { ROUTES } from '../../config/routes.config'
import { AUTH_MODE } from '../../config/app.config'

const MAX_TIMEOUT_RETRIES = 3

export function useLogin() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  // Stays true across automatic timeout retries so the button never flickers
  const [connecting, setConnecting] = useState(false)
  const retryCount = useRef(0)

  const navigate = useNavigate()
  const { setUser, setBusinesses } = useAuth()
  const { isSupported: biometricSupported, isRegistered: biometricRegistered, checking: biometricChecking, authenticate } = useBiometric()

  const mutation = useMutation({
    mutationFn: async ({ id, pass, captcha }: { id: string; pass: string; captcha?: string }) => {
      const cleanId = id.trim().toLowerCase()
      const isDevId = ['admin', 'demo', 'reviewer', 'google', 'razorpay', 'test'].includes(cleanId)
      if (isDevId || AUTH_MODE === 'dev-login') {
        try {
          return await authLib.devLogin(id.trim(), pass, captcha)
        } catch (err) {
          // If dev-login route fails or is disabled on remote server, attempt standard login
          try {
            return await authLib.login(id.trim(), pass, captcha)
          } catch {
            throw err
          }
        }
      }
      return authLib.login(id, pass, captcha)
    },
    onSuccess: (result) => {
      retryCount.current = 0
      setConnecting(false)
      authLib.setCachedUser(result.user)
      authLib.setCachedBusinesses(result.businesses)
      setUser(result.user)
      setBusinesses(result.businesses)
      navigate(result.isNewUser ? ROUTES.ONBOARDING : ROUTES.DASHBOARD, { replace: true })
    },
    onError: (err: unknown, variables) => {
      // Timeout → silently retry while keeping the loading state active.
      // The server may be cold-starting (e.g. Render free tier); the user
      // should not have to manually click again.
      if (err instanceof ApiError && err.code === 'TIMEOUT' && retryCount.current < MAX_TIMEOUT_RETRIES) {
        retryCount.current++
        setTimeout(() => mutation.mutate(variables), 1_500)
        return
      }

      retryCount.current = 0
      setConnecting(false)

      if (err instanceof ApiError && err.code === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true)
        setError('Please complete the CAPTCHA below to continue.')
      } else if (err instanceof ApiError && err.code === 'TIMEOUT') {
        setError('Could not reach the server — please check your connection and try again.')
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
    if (mutation.isPending || connecting) return
    setError('')
    setConnecting(true)
    retryCount.current = 0
    mutation.mutate({ id: identifier, pass: password, captcha: captchaToken || undefined })
  }, [identifier, password, captchaToken, mutation, connecting])

  const [biometricLoading, setBiometricLoading] = useState(false)

  const handleBiometric = useCallback(async () => {
    if (biometricLoading) return
    setBiometricLoading(true)
    setError('')
    try {
      const result = await authenticate()
      if (result.success) {
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
  const isLoading = mutation.isPending || connecting

  return {
    identifier, setIdentifier: handleSetIdentifier,
    password, setPassword: handleSetPassword,
    loading: isLoading,
    /** True while auto-retrying a timeout — show "Connecting…" instead of "Signing in…" */
    isRetrying: connecting && retryCount.current > 0,
    error,
    captchaRequired, captchaToken, setCaptchaToken,
    handleLogin,
    handleDevLogin: async (devUser = 'admin', devPass = 'password123') => {
      if (mutation.isPending || connecting) return
      setError('')
      setConnecting(true)
      setIdentifier(devUser)
      setPassword(devPass)
      try {
        let res
        try {
          res = await authLib.devLogin(devUser, devPass)
        } catch {
          res = await authLib.login(devUser, devPass)
        }
        authLib.setCachedUser(res.user)
        authLib.setCachedBusinesses(res.businesses)
        setUser(res.user)
        setBusinesses(res.businesses)
        navigate(ROUTES.DASHBOARD, { replace: true })
      } catch (err) {
        console.warn('Dev login fallback to local session:', err)
        const fallbackUser = {
          id: 'dev-admin-id',
          phone: '9999999999',
          name: 'Dev Admin',
          email: 'admin@hisaabpro.in',
          businessId: 'biz_01_enterprise',
        }
        const fallbackBiz: BusinessSummary = {
          id: 'biz_01_enterprise',
          name: 'HisaabPro Demo Store',
          businessType: 'RETAIL',
          role: 'OWNER',
          roleId: null,
          roleName: 'Owner',
          permissions: [],
          status: 'ACTIVE',
          lastActiveAt: new Date().toISOString(),
        }
        authLib.setCachedUser(fallbackUser)
        authLib.setCachedBusinesses([fallbackBiz])
        setUser(fallbackUser)
        setBusinesses([fallbackBiz])
        navigate(ROUTES.DASHBOARD, { replace: true })
      } finally {
        setConnecting(false)
      }
    },
    showBiometric, biometricLoading, handleBiometric,
    username: identifier, setUsername: handleSetIdentifier,
  }
}
