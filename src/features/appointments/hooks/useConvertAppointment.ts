/** useConvertAppointment — TanStack Query mutation for convert-to-bill.
 *
 *  - Generates a stable Idempotency-Key on first call; reuses it across
 *    retries so the server matches the same payload.
 *  - 404 (route missing) and 501 (server stub) both surface a friendly
 *    "coming soon" toast — see TODO FE-2.0 in `appointment-convert.service.ts`.
 *  - On success: invalidates appointments + jobs + documents/invoices keys
 *    so the UI re-fetches. Caller navigates to the created entity.
 */

import { useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { queryKeys } from '@/lib/query-keys'
import { convertAppointment } from '../appointment-convert.service'
import type {
  ConvertAppointmentBody,
  ConvertAppointmentResponse,
} from '../appointment.types'

interface ConvertVars {
  appointmentId: string
  body: ConvertAppointmentBody
  partyName: string
  startAtISO: string
}

export interface UseConvertAppointmentReturn {
  convert: (vars: ConvertVars) => Promise<ConvertAppointmentResponse | null>
  isPending: boolean
  /** Stable across retries — call `nextKey()` to mint a fresh one for a new attempt. */
  idempotencyKey: () => string
  nextKey: () => void
}

function mintKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `iv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function useConvertAppointment(): UseConvertAppointmentReturn {
  const qc = useQueryClient()
  const toast = useToast()
  const { t } = useLanguage()
  const keyRef = useRef<string>(mintKey())

  const mutation = useMutation({
    mutationFn: async (vars: ConvertVars) => {
      return convertAppointment(
        vars.appointmentId,
        vars.body,
        vars.partyName,
        vars.startAtISO,
        keyRef.current,
      )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.all() })
      // Best-effort — invalidate sibling keys that may exist in the cache.
      void qc.invalidateQueries({ queryKey: ['jobs'] })
      void qc.invalidateQueries({ queryKey: ['invoices'] })
      void qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success(t.appointmentConverted ?? 'Appointment converted')
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
        toast.info(t.conversionComingSoon ?? 'Conversion is rolling out — try again soon')
        return
      }
      const msg = err instanceof ApiError ? err.message : (t.appointmentSaveFailed ?? 'Could not convert')
      toast.error(msg)
    },
  })

  const convert = useCallback(
    async (vars: ConvertVars) => {
      try {
        return await mutation.mutateAsync(vars)
      } catch {
        return null
      }
    },
    [mutation],
  )

  return {
    convert,
    isPending: mutation.isPending,
    idempotencyKey: () => keyRef.current,
    nextKey: () => { keyRef.current = mintKey() },
  }
}
