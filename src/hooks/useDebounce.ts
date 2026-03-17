import { useState, useEffect } from 'react'
import { TIMEOUTS } from '@/config/app.config'

/** Returns a debounced value that updates after delay (default 300ms) */
export function useDebounce<T>(value: T, delay: number = TIMEOUTS.debounceMs): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
