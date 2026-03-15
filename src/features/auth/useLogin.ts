import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import * as authLib from '../../lib/auth'
import { ROUTES } from '../../config/routes.config'
import { RESEND_COOLDOWN_SEC } from './auth.constants'
import type { AuthStep } from './auth.types'

export function useLogin() {
  const [step, setStep] = useState<AuthStep>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const navigate = useNavigate()
  const { setUser } = useAuth()
  const submitting = useRef(false)
  const cooldownTimer = useRef<ReturnType<typeof setInterval>>(undefined)

  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SEC)
    clearInterval(cooldownTimer.current)
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleSendOtp = useCallback(async () => {
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setError('')

    try {
      await authLib.sendOtp(phone)
      setStep('otp')
      startCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }, [phone, startCooldown])

  const handleVerifyOtp = useCallback(async () => {
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    setError('')

    try {
      const result = await authLib.verifyOtp(phone, otp)
      authLib.setTokens(result.tokens.accessToken, result.tokens.refreshToken)
      authLib.setCachedUser(result.user)
      setUser(result.user)
      navigate(result.isNewUser ? ROUTES.ONBOARDING : ROUTES.DASHBOARD, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP')
      setOtp('')
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }, [phone, otp, setUser, navigate])

  const handleResendOtp = useCallback(async () => {
    if (resendCooldown > 0 || submitting.current) return
    submitting.current = true
    setError('')

    try {
      await authLib.sendOtp(phone)
      startCooldown()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP')
    } finally {
      submitting.current = false
    }
  }, [phone, resendCooldown, startCooldown])

  const handleBack = useCallback(() => {
    setStep('phone')
    setOtp('')
    setError('')
    clearInterval(cooldownTimer.current)
    setResendCooldown(0)
  }, [])

  return {
    step,
    phone,
    setPhone,
    otp,
    setOtp,
    loading,
    error,
    resendCooldown,
    handleSendOtp,
    handleVerifyOtp,
    handleResendOtp,
    handleBack,
  }
}
