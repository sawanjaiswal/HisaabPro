import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { queryKeys } from '@/lib/query-keys'
import type { SerialNumberDetail } from './serial-number.types'

type LookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

const MIN_SEARCH_LENGTH = 3

export function useSerialLookup() {
  const [searchTerm, setSearchTerm] = useState('')

  const debounced = useDebounce(searchTerm)
  const enabled = debounced.length >= MIN_SEARCH_LENGTH

  const query = useQuery({
    queryKey: queryKeys.serialNumbers.lookup(debounced),
    queryFn: ({ signal }) =>
      api<SerialNumberDetail>(
        `/serial-numbers/lookup?serial=${encodeURIComponent(debounced)}`,
        { signal },
      ),
    enabled,
    retry: false,
  })

  let status: LookupStatus = 'idle'
  let error: string | null = null

  if (!enabled) {
    status = 'idle'
  } else if (query.isPending) {
    status = 'loading'
  } else if (query.isError) {
    const err = query.error
    if (err instanceof ApiError && err.status === 404) {
      status = 'not_found'
    } else {
      status = 'error'
      error = err instanceof ApiError ? err.message : 'Lookup failed'
    }
  } else {
    status = 'found'
  }

  return {
    result: query.data ?? null,
    status,
    error,
    searchTerm,
    setSearchTerm,
  }
}
