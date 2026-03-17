/** Settings — Roles list hook
 *
 * Fetches all roles for the business, exposes refresh.
 * businessId is passed as a parameter (AuthUser has no businessId field).
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
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

  const [roles, setRoles] = useState<Role[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!businessId) return

    const controller = new AbortController()
    setStatus('loading')

    getRoles(businessId, controller.signal)
      .then((response) => {
        setRoles(response.data.roles)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load roles'
        toast.error(message)
      })

    return () => controller.abort()
  }, [businessId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return { roles, status, refresh }
}
