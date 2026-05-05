/**
 * usePtp — TanStack Query hooks for Promise-to-Pay.
 * All mutations pass entityType + entityLabel for the offline queue.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { formatPaise } from '@/lib/format'
import { createPtp, getPtpList, updatePtp, deletePtp } from './collections.service'
import type { CreatePtpInput, UpdatePtpInput, PtpStatus } from './collections.types'

const ptpKeys = {
  all: (partyId: string) => ['ptps', partyId] as const,
  list: (partyId: string, status?: PtpStatus) =>
    ['ptps', partyId, status ?? 'all'] as const,
}

// ─── List ────────────────────────────────────────────────────────────────────

export function usePtpList(partyId: string, status?: PtpStatus) {
  return useQuery({
    queryKey: ptpKeys.list(partyId, status),
    queryFn: () => getPtpList(partyId, status),
    enabled: Boolean(partyId),
    staleTime: 2 * 60 * 1000,
  })
}

// ─── Create ──────────────────────────────────────────────────────────────────

interface CreatePtpVars extends CreatePtpInput {
  partyName: string
}

export function useCreatePtp(partyId: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ partyName: _n, ...input }: CreatePtpVars) => createPtp(input),
    meta: {
      entityType: 'ptp',
    },
    onSuccess: (_data, vars) => {
      const label = `${vars.partyName} Rs ${formatPaise(vars.amountPaise)}`
      toast.success(`Promise recorded — ${label}`)
      queryClient.invalidateQueries({ queryKey: ptpKeys.all(partyId) })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to record promise')
    },
  })
}

// ─── Update ──────────────────────────────────────────────────────────────────

interface UpdatePtpVars extends UpdatePtpInput {
  id: string
  partyName: string
}

export function useUpdatePtp(partyId: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, partyName: _n, ...input }: UpdatePtpVars) => updatePtp(id, input),
    meta: { entityType: 'ptp' },
    onSuccess: () => {
      toast.success('Promise updated')
      queryClient.invalidateQueries({ queryKey: ptpKeys.all(partyId) })
    },
    onError: (err: Error) => {
      const msg = err.message.includes('PTP_NOT_EDITABLE')
        ? 'Only open promises can be edited'
        : err.message || 'Failed to update promise'
      toast.error(msg)
    },
  })
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export function useDeletePtp(partyId: string) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (id: string) => deletePtp(id),
    meta: { entityType: 'ptp' },
    onSuccess: () => {
      toast.success('Promise deleted')
      queryClient.invalidateQueries({ queryKey: ptpKeys.all(partyId) })
    },
    onError: (err: Error) => {
      const msg = err.message.includes('PTP_NOT_DELETABLE')
        ? 'Only open promises can be deleted'
        : err.message || 'Failed to delete promise'
      toast.error(msg)
    },
  })
}
