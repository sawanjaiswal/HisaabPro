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
  const controllerRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(() => {
    if (!path) return

    // Abort any in-flight request
    controllerRef.current?.abort()

    const id = ++fetchId.current
    const controller = new AbortController()
    controllerRef.current = controller
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
  }, [path])

  useEffect(() => {
    fetchData()
    return () => {
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [fetchData])

  return { data, status, error, refetch: fetchData }
}
