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
      return api<PaymentLink>(
        '/payments/payment-links',
        {
          method: 'POST',
          body: JSON.stringify({ invoiceId, amountPaise, expiryDays }),
          entityType: 'payment_link',
          entityLabel: invoiceNumber,
          headers: { 'X-Idempotency-Key': idempotencyKey },
        },
      )
    },
    onSuccess: (_data, vars) => {
      // F-22: invalidate both the keyed row and the full list so paid status
      // reflects immediately on the invoice list page.
      void qc.invalidateQueries({ queryKey: ['invoices'] })
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
      return api<PaymentLink[]>(
        `/payments/payment-links?invoiceId=${invoiceId}`,
      )
    },
    enabled: Boolean(invoiceId),
    staleTime: 30_000,
  })
}
