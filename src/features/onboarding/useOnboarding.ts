import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { ROUTES } from '../../config/routes.config'
import type { CreateBusinessResponse } from './onboarding.types'

export function useOnboarding() {
  const { user } = useAuth()

  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('general')
  const [phone, setPhone] = useState(user?.phone ?? '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const submitting = useRef(false)

  const handleSubmit = useCallback(async () => {
    if (submitting.current) return
    if (!businessName.trim()) {
      setError('Business name is required')
      return
    }

    submitting.current = true
    setLoading(true)
    setError('')

    try {
      await api<CreateBusinessResponse>('/businesses', {
        method: 'POST',
        body: JSON.stringify({
          name: businessName.trim(),
          businessType,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        }),
      })
      navigate(ROUTES.DASHBOARD, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create business. Please try again.')
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }, [businessName, businessType, phone, navigate])

  return {
    businessName,
    setBusinessName,
    businessType,
    setBusinessType,
    phone,
    setPhone,
    loading,
    error,
    handleSubmit,
  }
}
