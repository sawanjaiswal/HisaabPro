import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../lib/api'
import * as authLib from '../../lib/auth'
import { ROUTES } from '../../config/routes.config'


export function useLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')

  const navigate = useNavigate()
  const { setUser, setBusinesses } = useAuth()
  const submitting = useRef(false)

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
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setError('')

    try {
      const result = await authLib.devLogin(username, password, captchaToken || undefined)
      // Server sets httpOnly cookies automatically — only cache user for offline-first
      authLib.setCachedUser(result.user)
      authLib.setCachedBusinesses(result.businesses)
      setUser(result.user)
      setBusinesses(result.businesses)
      navigate(result.isNewUser ? ROUTES.ONBOARDING : ROUTES.DASHBOARD, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true)
        setError('Please complete the CAPTCHA below to continue.')
      } else {
        setError(err instanceof Error ? err.message : 'Login failed')
      }
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }, [username, password, captchaToken, setUser, setBusinesses, navigate])

  return {
    username, setUsername: handleSetUsername,
    password, setPassword: handleSetPassword,
    loading, error,
    captchaRequired, captchaToken, setCaptchaToken,
    handleLogin,
  }
}

// --- OTP-based login hook (commented out for dev, restore for production) ---
// export function useLoginOtp() {
//   const [step, setStep] = useState<AuthStep>('phone')
//   const [phone, setPhone] = useState('')
//   const [otp, setOtp] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState('')
//   const [resendCooldown, setResendCooldown] = useState(0)
//   const navigate = useNavigate()
//   const { setUser } = useAuth()
//   const submitting = useRef(false)
//   const cooldownTimer = useRef<ReturnType<typeof setInterval>>(undefined)
//   ... (full OTP flow preserved in git history)
// }
