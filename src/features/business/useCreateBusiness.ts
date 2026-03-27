import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { ROUTES } from '@/config/routes.config'
import { BUSINESS_NAME_MIN, BUSINESS_NAME_MAX } from './business.constants'
import type { CreateBusinessInput } from './business.types'

interface CreateBusinessErrors {
  name?: string
}

interface CreatedBusiness {
  id: string
  name: string
}

export function useCreateBusiness() {
  const navigate = useNavigate()
  const isSubmittingRef = useRef(false)

  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState('general')
  const [cloneEnabled, setCloneEnabled] = useState(false)
  const [cloneFromBusinessId, setCloneFromBusinessId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<CreateBusinessErrors>({})

  function validate(): boolean {
    const next: CreateBusinessErrors = {}
    const trimmed = name.trim()
    if (trimmed.length < BUSINESS_NAME_MIN) {
      next.name = `Name must be at least ${BUSINESS_NAME_MIN} characters`
    } else if (trimmed.length > BUSINESS_NAME_MAX) {
      next.name = `Name must be ${BUSINESS_NAME_MAX} characters or fewer`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit() {
    if (isSubmittingRef.current) return
    if (!validate()) return

    isSubmittingRef.current = true
    setIsSubmitting(true)

    const payload: CreateBusinessInput = {
      name: name.trim(),
      businessType,
      ...(cloneEnabled && cloneFromBusinessId
        ? { cloneFromBusinessId }
        : {}),
    }

    try {
      await api<CreatedBusiness>('/businesses', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      navigate(ROUTES.DASHBOARD)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create business'
      setErrors({ name: message })
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return {
    name,
    setName,
    businessType,
    setBusinessType,
    cloneEnabled,
    setCloneEnabled,
    cloneFromBusinessId,
    setCloneFromBusinessId,
    isSubmitting,
    errors,
    handleSubmit,
  }
}
