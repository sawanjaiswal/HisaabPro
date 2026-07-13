/** Onboarding hook (TanStack Query mutation) */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { ROUTES } from '../../config/routes.config'
import type { CreateBusinessResponse, DataSource, StartPath } from './onboarding.types'

export function useOnboarding() {
  const { user, refreshActiveBusiness } = useAuth()

  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('general')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [businessLocation, setBusinessLocation] = useState('')
  const [dataSource, setDataSource] = useState<DataSource | undefined>(undefined)
  const [startPath, setStartPath] = useState<StartPath | undefined>(undefined)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: (payload: { name: string; businessType: string; phone?: string }) =>
      api<CreateBusinessResponse>('/businesses', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      // The new business isn't in AuthContext yet — ProtectedRoute gates on
      // `businesses.length` and would bounce goToDashboard() straight back
      // to /onboarding without this refetch.
      await refreshActiveBusiness()
      setCreated(true)
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

  const goToDashboard = useCallback(() => {
    navigate(ROUTES.DASHBOARD, { replace: true })
  }, [navigate])

  return {
    businessName,
    setBusinessName,
    businessType,
    setBusinessType,
    phone,
    setPhone,
    businessLocation,
    setBusinessLocation,
    dataSource,
    setDataSource,
    startPath,
    setStartPath,
    loading: mutation.isPending,
    error,
    created,
    handleSubmit,
    goToDashboard,
  }
}
