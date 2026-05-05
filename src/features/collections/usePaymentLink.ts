/**
 * usePaymentLink — TanStack Query mutation + list query for payment links.
 *
 * Follows offline rules: api() wrapper, entityType/entityLabel on mutations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface PaymentLink {
  id: string
  invoiceId: string
  amountPaise: number
  shortUrl: string | null
  status: 'CREATED' | 'ACTIVE' | 'PAID' | 'EXPIRED' | 'CANCELLED'
  expireBy: string
  paidAt: string | null
  createdAt: string
}

export interface CreatePaymentLinkOpts {
  invoiceId: string
  invoiceNumber: string
  amountPaise?: number
  expiryDays?: number
  idempotencyKey: string
}

export function useCreatePaymentLink() {
  const qc = useQueryClient()

  return useMutation<PaymentLink, Error, CreatePaymentLinkOpts>({
    mutationFn: async ({ invoiceId, invoiceNumber, amountPaise, expiryDays, idempotencyKey }) => {
      const resp = await api<{ success: boolean; data: PaymentLink }>(
        '/api/payments/payment-links',
        {
          method: 'POST',
          body: JSON.stringify({ invoiceId, amountPaise, expiryDays }),
          entityType: 'payment_link',
          entityLabel: invoiceNumber,
          headers: { 'X-Idempotency-Key': idempotencyKey },
        },
      )
      return resp.data
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['invoices', vars.invoiceId] })
      void qc.invalidateQueries({ queryKey: ['payment-links', vars.invoiceId] })
    },
  })
}

export function usePaymentLinks(invoiceId: string | undefined) {
  return useQuery<PaymentLink[], Error>({
    queryKey: ['payment-links', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return []
      const resp = await api<{ success: boolean; data: PaymentLink[] }>(
        `/api/payments/payment-links?invoiceId=${invoiceId}`,
      )
      return resp.data ?? []
    },
    enabled: Boolean(invoiceId),
    staleTime: 30_000,
  })
}
