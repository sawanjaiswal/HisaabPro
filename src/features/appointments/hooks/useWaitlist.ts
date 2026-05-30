/** useWaitlist — list + add-to-waitlist hook.
 *
 *  TODO FE-2.1 — server endpoints (`/appointments/waitlist`) are not
 *  implemented yet. The list query swallows 404 silently (returns []), the
 *  mutation surfaces a friendly "coming soon" toast.
 */

import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { addToWaitlist, listWaitlist } from '../appointment-waitlist.service'
import type { WaitlistBody, WaitlistRow } from '../appointment.types'

interface UseWaitlistOptions {
  employeeId?: string
  from?: string
  to?: string
}

export interface UseWaitlistReturn {
  rows: WaitlistRow[]
  isPending: boolean
  add: (body: WaitlistBody, partyName: string) => Promise<WaitlistRow | null>
  isAdding: boolean
}

const QUERY_KEY = (opts: UseWaitlistOptions) => ['appointments', 'waitlist', opts] as const

export function useWaitlist(opts: UseWaitlistOptions = {}): UseWaitlistReturn {
  const qc = useQueryClient()
  const toast = useToast()
  const { t } = useLanguage()

  const query = useQuery({
    queryKey: QUERY_KEY(opts),
    queryFn: async ({ signal }) => {
      try {
        return await listWaitlist(opts, signal)
      } catch (err) {
        // Server route not implemented yet — return [] so UI is stable.
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return [] as WaitlistRow[]
        }
        throw err
      }
    },
    staleTime: 30_000,
  })

  const addMut = useMutation({
    mutationFn: async (vars: { body: WaitlistBody; partyName: string }) => {
      return addToWaitlist(vars.body, vars.partyName)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments', 'waitlist'] })
      toast.success(t.waitlistAdded ?? 'Added to waitlist')
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
        toast.info(t.waitlistComingSoon ?? 'Waitlist is rolling out — try again soon')
        return
      }
      const msg = err instanceof ApiError ? err.message : (t.appointmentSaveFailed ?? 'Could not save')
      toast.error(msg)
    },
  })

  const add = useCallback(
    async (body: WaitlistBody, partyName: string) => {
      try {
        return await addMut.mutateAsync({ body, partyName })
      } catch {
        return null
      }
    },
    [addMut],
  )

  return {
    rows: query.data ?? [],
    isPending: query.isPending,
    add,
    isAdding: addMut.isPending,
  }
}
