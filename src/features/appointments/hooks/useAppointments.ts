/** V2 Appointments — list-by-range hook.
 *
 * Network-only (no `cacheReads`) per OFFLINE_RULES.md rule 3 — appointment
 * rows can leak schedules across sessions on shared devices.
 */

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { queryKeys } from '@/lib/query-keys'
import { listAppointments } from '../appointment.service'
import { dateToISODate, startOfDay, endOfDay } from '../appointment.utils'
import { APPOINTMENT_LIST_STALE_MS } from '../appointment.constants'
import type { AppointmentRow } from '../appointment.types'

type Status = 'loading' | 'error' | 'success'

interface UseAppointmentsOptions {
  /** Local-time anchor day (defaults to today). */
  date?: Date
  employeeId?: string
}

interface UseAppointmentsReturn {
  data: AppointmentRow[]
  status: Status
  error: Error | null
  refresh: () => void
  isRefetching: boolean
}

export function useAppointments(options: UseAppointmentsOptions = {}): UseAppointmentsReturn {
  const toast = useToast()
  const { t } = useLanguage()
  const date = options.date ?? new Date()

  const from = startOfDay(date).toISOString()
  const to = endOfDay(date).toISOString()
  const employeeId = options.employeeId

  const filters = { date: dateToISODate(date), employeeId } as const

  const query = useQuery({
    queryKey: queryKeys.appointments.list(filters),
    queryFn: ({ signal }) => listAppointments({ from, to, employeeId }, signal),
    staleTime: APPOINTMENT_LIST_STALE_MS,
  })

  useEffect(() => {
    if (query.error) {
      const message = query.error instanceof ApiError
        ? query.error.message
        : (t.appointmentLoadFailed ?? 'Failed to load appointments')
      toast.error(message)
    }
  }, [query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return {
    data: query.data ?? [],
    status,
    error: (query.error as Error | null) ?? null,
    refresh: () => { void query.refetch() },
    isRefetching: query.isFetching && !query.isPending,
  }
}
