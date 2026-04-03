/** Onboarding hook (TanStack Query mutation) */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { ROUTES } from '../../config/routes.config'
import type { CreateBusinessResponse } from './onboarding.types'

export function useOnboarding() {
  const { user } = useAuth()

  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('general')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [error, setError] = useState('')

  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: (payload: { name: string; businessType: string; phone?: string }) =>
      api<CreateBusinessResponse>('/businesses', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      navigate(ROUTES.DASHBOARD, { replace: true })
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to create business. Please try again.')
    },
  })

  const handleSubmit = useCallback(async () => {
    if (mutation.isPending) return
    if (!businessName.trim()) {
      setError('Business name is required')
      return
    }

    setError('')
    mutation.mutate({
      name: businessName.trim(),
      businessType,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    })
  }, [businessName, businessType, phone, mutation])

  return {
    businessName,
    setBusinessName,
    businessType,
    setBusinessType,
    phone,
    setPhone,
    loading: mutation.isPending,
    error,
    handleSubmit,
  }
}
