/** useEInvoiceActions -- generate and cancel e-invoice mutations (TanStack Query) */

import { useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
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
  const generateMutation = useMutation({
    mutationFn: () => generateEInvoice(documentId),
    onSuccess: (result) => {
      onUpdate(() => ({
        irn: result.irn,
        ackNumber: result.ackNumber,
        ackDate: result.ackDate,
        qrCode: result.qrCode,
        status: 'GENERATED',
      }))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelEInvoice(documentId, reason),
    onSuccess: (_data, reason) => {
      onUpdate(prev => prev
        ? { ...prev, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: reason }
        : prev
      )
    },
  })

  const generateInvoice = useCallback(async () => {
    if (generateMutation.isPending) return
    await generateMutation.mutateAsync()
  }, [generateMutation])

  const cancelInvoice = useCallback(async (reason: string) => {
    if (cancelMutation.isPending) return
    await cancelMutation.mutateAsync(reason)
  }, [cancelMutation])

  return {
    generatingInvoice: generateMutation.isPending,
    cancellingInvoice: cancelMutation.isPending,
    generateInvoice,
    cancelInvoice,
  }
}
