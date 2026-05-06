/**
 * TanStack Query hooks for E-Invoice.
 * Queries cached; mutations invalidate on success.
 * Toast handling is left to the consuming component.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as svc from './e-invoice.service'
import type { CancelReason } from './e-invoice.types'

export const EINVOICE_QUERY_KEY = (docId: string) => ['einvoice', docId] as const

export function useEInvoice(documentId: string) {
  return useQuery({
    queryKey: EINVOICE_QUERY_KEY(documentId),
    queryFn: () => svc.getEInvoice(documentId),
    retry: false,
    throwOnError: false,
  })
}

export function useGenerateIrn(documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => svc.generateIrn(documentId),
    onSuccess: (data) => {
      qc.setQueryData(EINVOICE_QUERY_KEY(documentId), data)
    },
  })
}

export function useCancelIrn(documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reason, remarks }: { reason: CancelReason; remarks: string }) =>
      svc.cancelIrn(documentId, reason, remarks),
    onSuccess: (data) => {
      qc.setQueryData(EINVOICE_QUERY_KEY(documentId), data)
    },
  })
}
