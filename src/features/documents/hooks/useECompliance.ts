/** useECompliance — orchestrates status fetch + action sub-hooks
 *
 * Fetches e-invoice and e-way bill statuses in parallel on mount.
 * Action loading is managed per-domain in useEInvoiceActions / useEWayBillActions.
 * AbortController cleans up in-flight GETs on unmount.
 */

import { useState, useEffect, useCallback } from 'react'
import { getEInvoiceStatus, getEWayBillStatus } from '../ecompliance.service'
import { useEInvoiceActions } from './useEInvoiceActions'
import { useEWayBillActions } from './useEWayBillActions'
import type { EInvoiceStatus, EWayBillStatus } from '../ecompliance.types'

type FetchState = 'idle' | 'loading' | 'error' | 'success'

export function useECompliance(documentId: string) {
  const [fetchState, setFetchState] = useState<FetchState>('loading')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [eInvoice, setEInvoice] = useState<EInvoiceStatus | null>(null)
  const [eWayBill, setEWayBill] = useState<EWayBillStatus | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFetchState('loading')
    setFetchError(null)

    Promise.all([
      getEInvoiceStatus(documentId, controller.signal),
      getEWayBillStatus(documentId, controller.signal),
    ])
      .then(([invoice, ewb]) => {
        setEInvoice(invoice)
        setEWayBill(ewb)
        setFetchState('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setFetchError(err instanceof Error ? err.message : 'Failed to load compliance status')
        setFetchState('error')
      })

    return () => { controller.abort() }
  }, [documentId, refreshTick])

  const refresh = useCallback(() => { setRefreshTick(t => t + 1) }, [])

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
