/** Cash Register — TanStack Query mutation hooks */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  postCashEntry,
  patchCashEntry,
  voidCashEntry,
  restoreCashEntry,
  deleteCashEntry,
} from './cashRegister.service'

function invalidateCash(qc: ReturnType<typeof useQueryClient>, businessId: string) {
  void qc.invalidateQueries({ queryKey: ['cashHistory', businessId] })
  void qc.invalidateQueries({ queryKey: ['cashSummary', businessId] })
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function useCreateCashEntry(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: Parameters<typeof postCashEntry>[0]) => postCashEntry(args),
    onSuccess: () => invalidateCash(qc, businessId),
  })
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

export function useEditCashEntry(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: Parameters<typeof patchCashEntry>[0]) => patchCashEntry(args),
    onSuccess: () => invalidateCash(qc, businessId),
  })
}

// ─── Void ─────────────────────────────────────────────────────────────────────

export function useVoidCashEntry(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: Parameters<typeof voidCashEntry>[0]) => voidCashEntry(args),
    onSuccess: () => invalidateCash(qc, businessId),
  })
}

// ─── Restore ──────────────────────────────────────────────────────────────────

export function useRestoreCashEntry(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: Parameters<typeof restoreCashEntry>[0]) => restoreCashEntry(args),
    onSuccess: () => invalidateCash(qc, businessId),
  })
}

// ─── Hard delete ──────────────────────────────────────────────────────────────

export function useDeleteCashEntry(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: Parameters<typeof deleteCashEntry>[0]) => deleteCashEntry(args),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cashHistory', businessId] })
    },
  })
}
