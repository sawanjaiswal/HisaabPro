/** Join Business hook (TanStack Query mutation) */

import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import * as authLib from '@/lib/auth'
import { ApiError } from '@/lib/api'
import type { JoinBusinessSuccess } from './business.types'

export function useJoinBusiness() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<JoinBusinessSuccess | null>(null)

  const mutation = useMutation({
    mutationFn: (joinCode: string) => authLib.joinBusiness(joinCode),
    onSuccess: (result) => {
      setSuccess({
        businessName: result.business.name,
        roleName: result.businessUser.role,
      })
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Failed to join business')
    },
  })

  const handleCodeChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
    setCode(cleaned)
    setError('')
  }, [])

  const handleSubmit = useCallback(async () => {
    if (mutation.isPending || code.length !== 6) return
    setError('')
    mutation.mutate(code)
  }, [code, mutation])

  return { code, loading: mutation.isPending, error, success, handleCodeChange, handleSubmit }
}
