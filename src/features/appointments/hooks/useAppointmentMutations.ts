/** V2 Appointments — create + patch-status mutations.
 *
 * FE-1 minimal:
 *   - 409 CONFLICT (replay rejected or status transition invalid) → toast
 *     keyed to `t.appointmentReplayRejected`. Drawer-reopen with server
 *     state + Sentry breadcrumb land in FE-2.
 *   - Optimistic offline return `{}` is tolerated — handlers DO NOT deref
 *     response fields (per OFFLINE_RULES rule 5).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { queryKeys } from '@/lib/query-keys'
import {
  createAppointment,
  patchAppointmentStatus,
} from '../appointment.service'
import { buildEntityLabel } from '../appointment.utils'
import type {
  AppointmentRow,
  CreateAppointmentBody,
  PatchStatusBody,
} from '../appointment.types'

interface UseAppointmentMutationsReturn {
  isCreating: boolean
  isPatching: boolean
  create: (body: CreateAppointmentBody, partyName: string) => Promise<AppointmentRow>
  patchStatus: (
    appointmentId: string,
    body: PatchStatusBody,
    partyName: string,
    startAtISO: string,
  ) => Promise<AppointmentRow>
}

function interpolateReplay(template: string, label: string): string {
  return template.replace(/\{(party|entity)\}/g, label)
}

export function useAppointmentMutations(): UseAppointmentMutationsReturn {
  const toast = useToast()
  const { t } = useLanguage()
  const qc = useQueryClient()

  const handleError = (err: unknown, label: string) => {
    if (err instanceof ApiError) {
      // 409 = replay rejected or invalid transition. Use the dedicated key
      // so the user sees a feature-aware message; FE-2 will also reopen the
      // drawer with server state.
      if (err.status === 409) {
        toast.error(interpolateReplay(t.appointmentReplayRejected, label))
        return
      }
      toast.error(err.message)
      return
    }
    toast.error(t.appointmentSaveFailed ?? 'Could not save appointment')
  }

  const createMut = useMutation({
    mutationFn: async ({ body, partyName }: { body: CreateAppointmentBody; partyName: string }) => {
      return createAppointment(body, partyName)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.all() })
      toast.success(
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? (t.appointmentQueued ?? 'Saved — will sync when online')
          : (t.appointmentCreated ?? 'Appointment created'),
      )
    },
    onError: (err: unknown, vars) => {
      handleError(err, vars.partyName)
    },
  })

  const patchMut = useMutation({
    mutationFn: async (vars: {
      appointmentId: string
      body: PatchStatusBody
      partyName: string
      startAtISO: string
    }) => {
      return patchAppointmentStatus(vars.appointmentId, vars.body, vars.partyName, vars.startAtISO)
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.all() })
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.detail(vars.appointmentId) })
      toast.success(t.appointmentUpdated ?? 'Appointment updated')
    },
    onError: (err: unknown, vars) => {
      handleError(err, buildEntityLabel(vars.partyName, vars.startAtISO))
    },
  })

  return {
    isCreating: createMut.isPending,
    isPatching: patchMut.isPending,
    create: (body, partyName) => createMut.mutateAsync({ body, partyName }),
    patchStatus: (appointmentId, body, partyName, startAtISO) =>
      patchMut.mutateAsync({ appointmentId, body, partyName, startAtISO }),
  }
}
