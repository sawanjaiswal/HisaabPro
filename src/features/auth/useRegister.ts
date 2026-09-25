import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'

export function useRegister() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async () => {
    setError('')
    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }
    const cleanPhone = phone.trim().replace(/\D/g, '')
    const cleanEmail = email.trim()

    if (!cleanEmail && !cleanPhone) {
      setError('Please enter your email address to create your account.')
      return
    }

    if (cleanEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
      setError('Please enter a valid email address.')
      return
    }

    if (cleanPhone && cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number or leave it blank.')
      return
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: cleanEmail || undefined,
          phone: cleanPhone || undefined,
          businessName: businessName.trim() || undefined,
          password,
        }),
        offlineQueue: false,
      })

      navigate(ROUTES.VERIFY_OTP, {
        state: {
          email: cleanEmail,
          phone: cleanPhone,
          name: name.trim(),
          purpose: 'registration',
        },
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  return {
    name, setName,
    phone, setPhone,
    email, setEmail,
    businessName, setBusinessName,
    password, setPassword,
    loading, error,
    handleRegister,
  }
}
