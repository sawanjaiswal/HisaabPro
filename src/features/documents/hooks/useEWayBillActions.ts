/** useEWayBillActions -- generate, cancel, and update-Part-B mutations (TanStack Query) */

import { useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
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
  const generateMutation = useMutation({
    mutationFn: (input: Omit<EWayBillGenerateInput, 'documentId'>) =>
      generateEWayBill({ ...input, documentId }),
    onSuccess: (result, input) => {
      onUpdate(() => ({
        ewbNumber: result.ewbNumber,
        ewbDate: result.ewbDate,
        validUntil: result.validUntil,
        status: 'GENERATED',
        vehicleNumber: input.vehicleNumber,
        vehicleType: input.vehicleType,
        transportMode: input.transportMode,
      }))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelEWayBill(documentId, reason),
    onSuccess: (_data, reason) => {
      onUpdate(prev => prev
        ? { ...prev, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: reason }
        : prev
      )
    },
  })

  const updatePartBMutation = useMutation({
    mutationFn: ({ vehicleNumber, vehicleType }: { vehicleNumber: string; vehicleType?: VehicleType }) =>
      updateEWayBillPartB(documentId, vehicleNumber, vehicleType),
    onSuccess: (_data, { vehicleNumber, vehicleType }) => {
      onUpdate(prev => prev ? { ...prev, vehicleNumber, vehicleType } : prev)
    },
  })

  const generateEwb = useCallback(async (input: Omit<EWayBillGenerateInput, 'documentId'>) => {
    if (generateMutation.isPending) return
    await generateMutation.mutateAsync(input)
  }, [generateMutation])

  const cancelEwb = useCallback(async (reason: string) => {
    if (cancelMutation.isPending) return
    await cancelMutation.mutateAsync(reason)
  }, [cancelMutation])

  const updatePartB = useCallback(async (vehicleNumber: string, vehicleType?: VehicleType) => {
    if (updatePartBMutation.isPending) return
    await updatePartBMutation.mutateAsync({ vehicleNumber, vehicleType })
  }, [updatePartBMutation])

  return {
    generatingEwb: generateMutation.isPending,
    cancellingEwb: cancelMutation.isPending,
    updatingPartB: updatePartBMutation.isPending,
    generateEwb,
    cancelEwb,
    updatePartB,
  }
}
