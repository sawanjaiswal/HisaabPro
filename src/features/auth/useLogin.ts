/** Login hook -- mutation only (TanStack Query) */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../lib/api'
import * as authLib from '../../lib/auth'
import { ROUTES } from '../../config/routes.config'

export function useLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')

  const navigate = useNavigate()
  const { setUser, setBusinesses } = useAuth()

  const mutation = useMutation({
    mutationFn: ({ user, pass, captcha }: { user: string; pass: string; captcha?: string }) =>
      authLib.devLogin(user, pass, captcha),
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

  // Reset captcha token whenever the user changes credentials
  const handleSetUsername = useCallback((value: string) => {
    setUsername(value)
    setCaptchaToken('')
  }, [])

  const handleSetPassword = useCallback((value: string) => {
    setPassword(value)
    setCaptchaToken('')
  }, [])

  const handleLogin = useCallback(async () => {
    if (mutation.isPending) return
    setError('')
    mutation.mutate({ user: username, pass: password, captcha: captchaToken || undefined })
  }, [username, password, captchaToken, mutation])

  return {
    username, setUsername: handleSetUsername,
    password, setPassword: handleSetPassword,
    loading: mutation.isPending, error,
    captchaRequired, captchaToken, setCaptchaToken,
    handleLogin,
  }
}
