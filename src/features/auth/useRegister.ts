import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'

export function useRegister() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async () => {
    setError('')
    setLoading(true)
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), phone, password }),
        offlineQueue: false,
      })
      // Navigate to OTP screen with phone in state
      navigate(ROUTES.VERIFY_OTP, { state: { phone, purpose: 'registration' } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { name, setName, phone, setPhone, password, setPassword, loading, error, handleRegister }
}
