/** useEInvoiceActions — generate and cancel e-invoice mutations */

import { useState, useCallback } from 'react'
import { generateEInvoice, cancelEInvoice } from '../ecompliance.service'
import type { EInvoiceStatus } from '../ecompliance.types'

interface EInvoiceActions {
  generatingInvoice: boolean
  cancellingInvoice: boolean
  generateInvoice: () => Promise<void>
  cancelInvoice: (reason: string) => Promise<void>
}

export function useEInvoiceActions(
  documentId: string,
  onUpdate: (updater: (prev: EInvoiceStatus | null) => EInvoiceStatus | null) => void
): EInvoiceActions {
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  const [cancellingInvoice, setCancellingInvoice] = useState(false)

  const generateInvoice = useCallback(async () => {
    if (generatingInvoice) return
    setGeneratingInvoice(true)
    try {
      const result = await generateEInvoice(documentId)
      onUpdate(() => ({
        irn: result.irn,
        ackNumber: result.ackNumber,
        ackDate: result.ackDate,
        qrCode: result.qrCode,
        status: 'GENERATED',
      }))
    } finally {
      setGeneratingInvoice(false)
    }
  }, [documentId, generatingInvoice, onUpdate])

  const cancelInvoice = useCallback(async (reason: string) => {
    if (cancellingInvoice) return
    setCancellingInvoice(true)
    try {
      await cancelEInvoice(documentId, reason)
      onUpdate(prev => prev
        ? { ...prev, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: reason }
        : prev
      )
    } finally {
      setCancellingInvoice(false)
    }
  }, [documentId, cancellingInvoice, onUpdate])

  return { generatingInvoice, cancellingInvoice, generateInvoice, cancelInvoice }
}
