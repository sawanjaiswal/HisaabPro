/** Hook: pre-populate Create Invoice form from bill-scan navigation state. */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface ScannedItem {
  productId: string
  productName: string
  quantity: number
  rate: number
  discountType: 'PERCENTAGE'
  discountValue: number
}

interface BillScanState {
  scannedItems?: ScannedItem[]
  scannedDate?: string
}

interface Args {
  addLineItem: (item: {
    productId: string
    quantity: number
    rate: number
    discountType: 'PERCENTAGE'
    discountValue: number
    taxCategoryId: null
    hsnCode: string
  }) => void
  updateField: (key: 'documentDate', value: string) => void
  setProductNames: (fn: (prev: Record<string, string>) => Record<string, string>) => void
}

export function useBillScanPrefill({ addLineItem, updateField, setProductNames }: Args) {
  const location = useLocation()

  useEffect(() => {
    const state = location.state as BillScanState | null
    if (!state?.scannedItems?.length) return

    const names: Record<string, string> = {}
    for (const item of state.scannedItems) {
      const scanId = item.productId || `scan-${crypto.randomUUID()}`
      names[scanId] = item.productName
      addLineItem({
        productId: scanId,
        quantity: item.quantity,
        rate: item.rate,
        discountType: item.discountType,
        discountValue: item.discountValue,
        taxCategoryId: null,
        hsnCode: '',
      })
    }
    setProductNames((prev) => ({ ...prev, ...names }))

    if (state.scannedDate) updateField('documentDate', state.scannedDate)

    window.history.replaceState({}, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
