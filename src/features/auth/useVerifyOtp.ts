import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, ApiError } from '@/lib/api'
import * as authLib from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/config/routes.config'
import type { AuthUser, BusinessSummary } from './auth.types'

const OTP_TTL_SEC = 5 * 60 // 5 minutes
const RESEND_COOLDOWN_SEC = 30

interface LocationState {
  phone?: string
  purpose?: 'registration' | 'login'
}

export function useVerifyOtp() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: LocationState | null }
  const { setUser, setBusinesses } = useAuth()

  const phone = state?.phone ?? ''

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SEC)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SEC)
  const [resending, setResending] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // OTP expiry countdown
  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [secondsLeft])

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  // Redirect if no phone in state
  useEffect(() => {
    if (!phone) navigate(ROUTES.REGISTER, { replace: true })
  }, [phone, navigate])

  const handleDigit = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)
    setError('')

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [otp])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [otp])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setOtp(text.split(''))
      inputRefs.current[5]?.focus()
    }
  }, [])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length < 6) return
    setError('')
    setLoading(true)
    try {
      const result = await api<{
        user: AuthUser
        businesses: BusinessSummary[]
        activeBusiness: BusinessSummary | null
      }>('/auth/verify-registration', {
        method: 'POST',
        body: JSON.stringify({ phone, otp: code }),
        offlineQueue: false,
      })
      const businessId = result.activeBusiness?.id ?? result.businesses[0]?.id ?? null
      const user = { ...result.user, businessId }
      authLib.setCachedUser(user)
      authLib.setCachedBusinesses(result.businesses)
      setUser(user)
      setBusinesses(result.businesses)
      navigate(ROUTES.ONBOARDING, { replace: true })
    } catch (err) {
      triggerShake()
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
      setError(err instanceof ApiError ? err.message : 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return
    setResending(true)
    setError('')
    try {
      await api('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
        offlineQueue: false,
      })
      setSecondsLeft(OTP_TTL_SEC)
      setResendCooldown(RESEND_COOLDOWN_SEC)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resend OTP.')
    } finally {
      setResending(false)
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return {
    phone, otp, loading, error, shake,
    secondsLeft, resendCooldown, resending,
    inputRefs, formatTime,
    handleDigit, handleKeyDown, handlePaste, handleVerify, handleResend,
  }
}
