/** Settings — Staff list hook
 *
 * Fetches active staff and pending invites.
 * Handles suspend, remove and resend invite with confirmation guards.
 * businessId is passed as a parameter.
 */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getStaff, suspendStaff, removeStaff, resendInvite } from './settings.service'
import type { StaffMember, StaffInvite } from './settings.types'

type Status = 'loading' | 'error' | 'success'

interface StaffData {
  staff: StaffMember[]
  pending: StaffInvite[]
}

interface UseStaffReturn {
  data: StaffData | null
  status: Status
  refresh: () => void
  handleSuspend: (staffId: string, staffName: string) => void
  handleRemove: (staffId: string, staffName: string) => void
  handleResendInvite: (inviteId: string) => void
}

export function useStaff(businessId: string): UseStaffReturn {
  const toast = useToast()

  const [data, setData] = useState<StaffData | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!businessId) return

    const controller = new AbortController()
    setStatus('loading')

    getStaff(businessId, controller.signal)
      .then((response) => {
        setData(response.data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load staff'
        toast.error(message)
      })

    return () => controller.abort()
  }, [businessId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleSuspend = useCallback((staffId: string, staffName: string) => {
    if (!window.confirm(`Suspend ${staffName}? They will no longer be able to log in.`)) return

    suspendStaff(businessId, staffId)
      .then(() => {
        toast.success(`${staffName} suspended`)
        refresh()
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to suspend staff member'
        toast.error(message)
      })
  }, [businessId, refresh, toast])

  const handleRemove = useCallback((staffId: string, staffName: string) => {
    if (!window.confirm(`Remove ${staffName} permanently? This cannot be undone.`)) return

    removeStaff(businessId, staffId)
      .then(() => {
        toast.success(`${staffName} removed`)
        refresh()
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to remove staff member'
        toast.error(message)
      })
  }, [businessId, refresh, toast])

  const handleResendInvite = useCallback((inviteId: string) => {
    resendInvite(businessId, inviteId)
      .then(() => {
        toast.success('Invite resent successfully')
        refresh()
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Failed to resend invite'
        toast.error(message)
      })
  }, [businessId, refresh, toast])

  return {
    data,
    status,
    refresh,
    handleSuspend,
    handleRemove,
    handleResendInvite,
  }
}
