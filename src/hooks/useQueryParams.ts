/** Shared hook — read/write URL search params with type safety
 *
 * Wraps React Router's useSearchParams with a simpler API.
 * Keeps URL as the source of truth for filter/tab state.
 * Max 60 lines per hook rule.
 */

import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

interface UseQueryParamsReturn {
  /** Get a single param value (null if absent) */
  get: (key: string) => string | null
  /** Get a param with a fallback default */
  getOr: (key: string, fallback: string) => string
  /** Set a single param (removes if value matches default) */
  set: (key: string, value: string, defaultValue?: string) => void
  /** Set multiple params at once */
  setMany: (params: Record<string, string | undefined>) => void
  /** Remove a param from the URL */
  remove: (key: string) => void
  /** Get the raw URLSearchParams object */
  params: URLSearchParams
}

export function useQueryParams(): UseQueryParamsReturn {
  const [searchParams, setSearchParams] = useSearchParams()

  const get = useCallback((key: string) => searchParams.get(key), [searchParams])

  const getOr = useCallback(
    (key: string, fallback: string) => searchParams.get(key) ?? fallback,
    [searchParams],
  )

  const set = useCallback(
    (key: string, value: string, defaultValue?: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (defaultValue !== undefined && value === defaultValue) {
          next.delete(key)
        } else {
          next.set(key, value)
        }
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const setMany = useCallback(
    (params: Record<string, string | undefined>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(params)) {
          if (value === undefined) next.delete(key)
          else next.set(key, value)
        }
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const remove = useCallback(
    (key: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete(key)
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  return { get, getOr, set, setMany, remove, params: searchParams }
}
