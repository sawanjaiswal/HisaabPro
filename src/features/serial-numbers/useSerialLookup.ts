import { useState, useEffect } from 'react'
import { api, ApiError } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import type { SerialNumberDetail } from './serial-number.types'

type LookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

const MIN_SEARCH_LENGTH = 3

export function useSerialLookup() {
  const [searchTerm, setSearchTerm] = useState('')
  const [result, setResult] = useState<SerialNumberDetail | null>(null)
  const [status, setStatus] = useState<LookupStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const debounced = useDebounce(searchTerm)

  useEffect(() => {
    if (debounced.length < MIN_SEARCH_LENGTH) {
      setStatus('idle')
      setResult(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    setStatus('loading')
    setError(null)

    api<SerialNumberDetail>(`/serial-numbers/lookup?serial=${encodeURIComponent(debounced)}`, {
      signal: controller.signal,
    })
      .then((data) => { setResult(data); setStatus('found') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 404) {
          setResult(null)
          setStatus('not_found')
        } else {
          setError(err instanceof ApiError ? err.message : 'Lookup failed')
          setStatus('error')
        }
      })

    return () => controller.abort()
  }, [debounced])

  return { result, status, error, searchTerm, setSearchTerm }
}
