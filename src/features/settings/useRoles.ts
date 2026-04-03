/** Settings — Roles list hook (TanStack Query)
 *
 * Fetches all roles for the business, exposes refresh.
 * businessId is passed as a parameter (AuthUser has no businessId field).
 */

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { getRoles } from './role.service'
import type { Role } from './settings.types'

type Status = 'loading' | 'error' | 'success'

interface UseRolesReturn {
  roles: Role[]
  status: Status
  refresh: () => void
}

export function useRoles(businessId: string): UseRolesReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.settings.roles(),
    queryFn: ({ signal }) => getRoles(businessId, signal),
    enabled: !!businessId,
  })

  const roles = query.data?.data.roles ?? []
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError ? query.error.message : 'Failed to load roles'
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.roles() })
  }

  return { roles, status, refresh }
}
