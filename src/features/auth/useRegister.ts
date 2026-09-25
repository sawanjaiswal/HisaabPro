import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/lib/api'
import * as authLib from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/config/routes.config'
import type { AuthUser, BusinessSummary } from './auth.types'

export function useRegister() {
  const navigate = useNavigate()
  const { setUser, setBusinesses } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await api<{
        isNewUser: boolean
        user: AuthUser
        businesses: BusinessSummary[]
        activeBusiness: BusinessSummary | null
      }>('/auth/direct-register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone,
          email: email.trim() || undefined,
          businessName: businessName.trim() || undefined,
          password,
        }),
        offlineQueue: false,
      })

      const businessId = result.activeBusiness?.id ?? result.businesses[0]?.id ?? null
      const user = { ...result.user, businessId }

      authLib.setCachedUser(user)
      authLib.setCachedBusinesses(result.businesses)
      setUser(user)
      setBusinesses(result.businesses)

      navigate(ROUTES.DASHBOARD, { replace: true })
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
