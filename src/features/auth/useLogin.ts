import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import * as authLib from '../../lib/auth'
import { ROUTES } from '../../config/routes.config'


export function useLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const { setUser } = useAuth()
  const submitting = useRef(false)

  const handleLogin = useCallback(async () => {
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setError('')

    try {
      const result = await authLib.devLogin(username, password)
      authLib.setTokens(result.tokens.accessToken, result.tokens.refreshToken)
      authLib.setCachedUser(result.user)
      setUser(result.user)
      navigate(result.isNewUser ? ROUTES.ONBOARDING : ROUTES.DASHBOARD, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }, [username, password, setUser, navigate])

  return {
    username,
    setUsername,
    password,
    setPassword,
    loading,
    error,
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
