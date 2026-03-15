import { useState, useEffect, useCallback, useRef } from 'react'
import { api, ApiError } from '@/lib/api'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface UseApiResult<T> {
  data: T | null
  status: Status
  error: ApiError | null
  refetch: () => void
}

/** Fetch data with loading/error states and auto-abort on cleanup */
export function useApi<T>(path: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<Status>(path ? 'loading' : 'idle')
  const [error, setError] = useState<ApiError | null>(null)
  const fetchId = useRef(0)

  const fetchData = useCallback(() => {
    if (!path) return

    const id = ++fetchId.current
    const controller = new AbortController()
    setStatus('loading')
    setError(null)

    api<T>(path, { signal: controller.signal })
      .then((result) => {
        if (id === fetchId.current) {
          setData(result)
          setStatus('success')
        }
      })
      .catch((err) => {
        if (id === fetchId.current && err.name !== 'AbortError') {
          setError(err instanceof ApiError ? err : new ApiError(String(err), 'UNKNOWN', 0))
          setStatus('error')
        }
      })

    return () => controller.abort()
  }, [path])

  useEffect(() => {
    const cleanup = fetchData()
    return cleanup
  }, [fetchData])

  return { data, status, error, refetch: fetchData }
}
