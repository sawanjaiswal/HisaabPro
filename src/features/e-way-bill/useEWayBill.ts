/**
 * TanStack Query hooks for E-Way Bill.
 * Queries cached; mutations invalidate on success.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as svc from './e-way-bill.service'
import type { GenerateEWBInput, UpdatePartBInput } from './e-way-bill.types'

export const EWB_QUERY_KEY = (docId: string) => ['ewaybill', docId] as const

export function useEWayBill(documentId: string) {
  return useQuery({
    queryKey: EWB_QUERY_KEY(documentId),
    queryFn: () => svc.getEWayBill(documentId),
    retry: false,
    throwOnError: false,
  })
}

export function useGenerateEWayBill(documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<GenerateEWBInput, 'documentId'>) =>
      svc.generateEWayBill({ ...input, documentId }),
    onSuccess: (data) => {
      qc.setQueryData(EWB_QUERY_KEY(documentId), data)
    },
  })
}

export function useUpdatePartB(documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<UpdatePartBInput, 'documentId'>) =>
      svc.updatePartB({ ...input, documentId }),
    onSuccess: (data) => {
      qc.setQueryData(EWB_QUERY_KEY(documentId), data)
    },
  })
}

export function useCancelEWayBill(documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) =>
      svc.cancelEWayBill({ documentId, reason }),
    onSuccess: (data) => {
      qc.setQueryData(EWB_QUERY_KEY(documentId), data)
    },
  })
}
