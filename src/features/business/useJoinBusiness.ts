import { useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as authLib from '@/lib/auth'
import { ApiError } from '@/lib/api'
import type { JoinBusinessSuccess } from './business.types'

export function useJoinBusiness() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<JoinBusinessSuccess | null>(null)
  const submitting = useRef(false)

  const handleCodeChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
    setCode(cleaned)
    setError('')
  }, [])

  const handleSubmit = useCallback(async () => {
    if (submitting.current || code.length !== 6) return
    submitting.current = true
    setLoading(true)
    setError('')

    try {
      const result = await authLib.joinBusiness(code)
      setSuccess({
        businessName: result.business.name,
        roleName: result.businessUser.role,
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to join business')
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }, [code])

  return { code, loading, error, success, handleCodeChange, handleSubmit }
}
