/** Settings — Staff list hook (TanStack Query)
 *
 * Fetches active staff and pending invites.
 * Handles suspend, remove and resend invite with confirmation guards.
 * businessId is passed as a parameter.
 */

import { useEffect, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { getStaff, suspendStaff, removeStaff, resendInvite, updateStaffRole } from './staff.service'
import { getRoles } from './role.service'
import type { StaffMember, StaffInvite, Role } from './settings.types'

type Status = 'loading' | 'error' | 'success'

interface StaffData {
  staff: StaffMember[]
  pending: StaffInvite[]
}

interface UseStaffReturn {
  data: StaffData | null
  status: Status
  roles: Role[]
  refresh: () => void
  handleSuspend: (staffId: string, staffName: string) => void
  handleRemove: (staffId: string, staffName: string) => void
  handleResendInvite: (inviteId: string) => void
  handleChangeRole: (staffId: string, staffName: string, roleId: string) => void
}

export function useStaff(businessId: string): UseStaffReturn {
  const toast = useToast()
  const queryClient = useQueryClient()

  // Fetch staff list
  const staffQuery = useQuery({
    queryKey: queryKeys.settings.staff(),
    queryFn: ({ signal }) => getStaff(businessId, signal),
    enabled: !!businessId,
  })

  // Fetch roles alongside staff
  const rolesQuery = useQuery({
    queryKey: queryKeys.settings.roles(),
    queryFn: ({ signal }) => getRoles(businessId, signal),
    enabled: !!businessId,
  })

  const data: StaffData | null = staffQuery.data?.data ?? null
  const roles: Role[] = rolesQuery.data?.data.roles ?? []

  // Combined status: loading if either is pending, error if either errored
  const isAnyPending = staffQuery.isPending || rolesQuery.isPending
  const isAnyError = staffQuery.isError || rolesQuery.isError
  const status: Status = isAnyPending ? 'loading' : isAnyError ? 'error' : 'success'

  // Show toast on fetch error
  useEffect(() => {
    const err = staffQuery.error || rolesQuery.error
    if (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load staff'
      toast.error(message)
    }
  }, [staffQuery.error, rolesQuery.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidateStaff = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.staff() })
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.roles() })
  }, [queryClient])

  const refresh = invalidateStaff

  // Suspend mutation
  const suspendMutation = useMutation({
    mutationFn: ({ staffId }: { staffId: string; staffName: string }) =>
      suspendStaff(businessId, staffId),
    onSuccess: (_data, { staffName }) => {
      toast.success(`${staffName} suspended`)
      invalidateStaff()
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to suspend staff member'
      toast.error(message)
    },
  })

  const handleSuspend = useCallback((staffId: string, staffName: string) => {
    if (!window.confirm(`Suspend ${staffName}? They will no longer be able to log in.`)) return
    suspendMutation.mutate({ staffId, staffName })
  }, [suspendMutation])

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: ({ staffId }: { staffId: string; staffName: string }) =>
      removeStaff(businessId, staffId),
    onSuccess: (_data, { staffName }) => {
      toast.success(`${staffName} removed`)
      invalidateStaff()
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to remove staff member'
      toast.error(message)
    },
  })

  const handleRemove = useCallback((staffId: string, staffName: string) => {
    if (!window.confirm(`Remove ${staffName} permanently? This cannot be undone.`)) return
    removeMutation.mutate({ staffId, staffName })
  }, [removeMutation])

  // Resend invite mutation
  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => resendInvite(businessId, inviteId),
    onSuccess: () => {
      toast.success('Invite resent successfully')
      invalidateStaff()
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to resend invite'
      toast.error(message)
    },
  })

  const handleResendInvite = useCallback((inviteId: string) => {
    resendMutation.mutate(inviteId)
  }, [resendMutation])

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: ({ staffId, roleId }: { staffId: string; staffName: string; roleId: string }) =>
      updateStaffRole(businessId, staffId, roleId),
    onSuccess: (res, { staffName }) => {
      toast.success(`${staffName} is now ${res.data.roleName}`)
      invalidateStaff()
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : 'Failed to change role'
      toast.error(message)
    },
  })

  const handleChangeRole = useCallback((staffId: string, staffName: string, roleId: string) => {
    changeRoleMutation.mutate({ staffId, staffName, roleId })
  }, [changeRoleMutation])

  return {
    data,
    status,
    roles,
    refresh,
    handleSuspend,
    handleRemove,
    handleResendInvite,
    handleChangeRole,
  }
}
