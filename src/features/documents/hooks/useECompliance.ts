/** useECompliance -- orchestrates status fetch + action sub-hooks (TanStack Query)
 *
 * Fetches e-invoice and e-way bill statuses in parallel on mount.
 * Action loading is managed per-domain in useEInvoiceActions / useEWayBillActions.
 */

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEInvoiceStatus, getEWayBillStatus } from '../ecompliance.service'
import { useEInvoiceActions } from './useEInvoiceActions'
import { useEWayBillActions } from './useEWayBillActions'
import type { EInvoiceStatus, EWayBillStatus } from '../ecompliance.types'

type FetchState = 'idle' | 'loading' | 'error' | 'success'

const ECOMPLIANCE_KEY = (documentId: string) => ['ecompliance', documentId] as const

export function useECompliance(documentId: string) {
  const queryClient = useQueryClient()
  const [eInvoice, setEInvoice] = useState<EInvoiceStatus | null>(null)
  const [eWayBill, setEWayBill] = useState<EWayBillStatus | null>(null)

  const query = useQuery({
    queryKey: ECOMPLIANCE_KEY(documentId),
    queryFn: async ({ signal }) => {
      const [invoice, ewb] = await Promise.all([
        getEInvoiceStatus(documentId, signal),
        getEWayBillStatus(documentId, signal),
      ])
      return { invoice, ewb }
    },
    enabled: Boolean(documentId),
  })

  // Sync query data into local state so action hooks can update optimistically
  useEffect(() => {
    if (query.data) {
      setEInvoice(query.data.invoice)
      setEWayBill(query.data.ewb)
    }
  }, [query.data])

  const fetchState: FetchState = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : query.isSuccess
        ? 'success'
        : 'idle'

  const fetchError = query.isError
    ? (query.error instanceof Error ? query.error.message : 'Failed to load compliance status')
    : null

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ECOMPLIANCE_KEY(documentId) })
  }

  const invoiceActions = useEInvoiceActions(documentId, setEInvoice)
  const ewbActions = useEWayBillActions(documentId, setEWayBill)

  return {
    fetchState,
    fetchError,
    eInvoice,
    eWayBill,
    refresh,
    ...invoiceActions,
    ...ewbActions,
  }
}
