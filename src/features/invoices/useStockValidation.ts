/** Stock Validation — Debounced hook for line item stock checks
 *
 * Runs a debounced stock validation API call whenever line items change.
 * Only validates outgoing document types (SALE_INVOICE, DELIVERY_CHALLAN).
 * Best-effort — failures are silently ignored.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { TIMEOUTS } from '@/config/app.config'
import { validateStock } from './invoice.service'
import type { StockValidationItem } from './invoice.service'
import type { DocumentType, LineItemFormData } from './invoice.types'

export interface StockValidationResult {
  stockWarnings: StockValidationItem[]
  hasStockBlocks: boolean
}

export function useStockValidation(
  lineItems: LineItemFormData[],
  type: DocumentType,
): StockValidationResult {
  const [stockWarnings, setStockWarnings] = useState<StockValidationItem[]>([])
  const stockAbortRef = useRef<AbortController | null>(null)

  const isSaleType = type === 'SALE_INVOICE' || type === 'DELIVERY_CHALLAN'

  useEffect(() => {
    if (!isSaleType || lineItems.length === 0) {
      setStockWarnings([])
      return
    }

    const items = lineItems
      .filter(li => li.productId && li.quantity > 0)
      .map(li => ({ productId: li.productId, quantity: li.quantity, unitId: li.productId }))

    if (items.length === 0) {
      setStockWarnings([])
      return
    }

    const timerId = setTimeout(() => {
      stockAbortRef.current?.abort()
      const controller = new AbortController()
      stockAbortRef.current = controller

      validateStock(items)
        .then(result => {
          if (!controller.signal.aborted) {
            setStockWarnings(result.items.filter(i => i.validation !== 'OK'))
          }
        })
        .catch(() => {
          // Silently ignore — stock validation is best-effort
        })
    }, TIMEOUTS.debounceMs)

    return () => {
      clearTimeout(timerId)
      stockAbortRef.current?.abort()
    }
  }, [lineItems, isSaleType]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasStockBlocks = useMemo(
    () => stockWarnings.some(w => w.validation === 'BLOCK'),
    [stockWarnings],
  )

  return { stockWarnings, hasStockBlocks }
}
