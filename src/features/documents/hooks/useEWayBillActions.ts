/** useEWayBillActions — generate, cancel, and update-Part-B mutations */

import { useState, useCallback } from 'react'
import { generateEWayBill, cancelEWayBill, updateEWayBillPartB } from '../ecompliance.service'
import type { EWayBillStatus, EWayBillGenerateInput, VehicleType } from '../ecompliance.types'

interface EWayBillActions {
  generatingEwb: boolean
  cancellingEwb: boolean
  updatingPartB: boolean
  generateEwb: (input: Omit<EWayBillGenerateInput, 'documentId'>) => Promise<void>
  cancelEwb: (reason: string) => Promise<void>
  updatePartB: (vehicleNumber: string, vehicleType?: VehicleType) => Promise<void>
}

export function useEWayBillActions(
  documentId: string,
  onUpdate: (updater: (prev: EWayBillStatus | null) => EWayBillStatus | null) => void
): EWayBillActions {
  const [generatingEwb, setGeneratingEwb] = useState(false)
  const [cancellingEwb, setCancellingEwb] = useState(false)
  const [updatingPartB, setUpdatingPartB] = useState(false)

  const generateEwb = useCallback(async (input: Omit<EWayBillGenerateInput, 'documentId'>) => {
    if (generatingEwb) return
    setGeneratingEwb(true)
    try {
      const result = await generateEWayBill({ ...input, documentId })
      onUpdate(() => ({
        ewbNumber: result.ewbNumber,
        ewbDate: result.ewbDate,
        validUntil: result.validUntil,
        status: 'GENERATED',
        vehicleNumber: input.vehicleNumber,
        vehicleType: input.vehicleType,
        transportMode: input.transportMode,
      }))
    } finally {
      setGeneratingEwb(false)
    }
  }, [documentId, generatingEwb, onUpdate])

  const cancelEwb = useCallback(async (reason: string) => {
    if (cancellingEwb) return
    setCancellingEwb(true)
    try {
      await cancelEWayBill(documentId, reason)
      onUpdate(prev => prev
        ? { ...prev, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: reason }
        : prev
      )
    } finally {
      setCancellingEwb(false)
    }
  }, [documentId, cancellingEwb, onUpdate])

  const updatePartB = useCallback(async (vehicleNumber: string, vehicleType?: VehicleType) => {
    if (updatingPartB) return
    setUpdatingPartB(true)
    try {
      await updateEWayBillPartB(documentId, vehicleNumber, vehicleType)
      onUpdate(prev => prev ? { ...prev, vehicleNumber, vehicleType } : prev)
    } finally {
      setUpdatingPartB(false)
    }
  }, [documentId, updatingPartB, onUpdate])

  return { generatingEwb, cancellingEwb, updatingPartB, generateEwb, cancelEwb, updatePartB }
}
