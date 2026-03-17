/** useECompliance — hook for e-invoice and e-way bill status + actions
 *
 * Fetches both statuses on mount using parallel requests.
 * Each action (generate/cancel/updatePartB) exposes its own loading flag
 * so the UI can disable just the relevant button.
 * AbortController cleans up in-flight GET requests on unmount.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getEInvoiceStatus,
  generateEInvoice,
  cancelEInvoice,
  getEWayBillStatus,
  generateEWayBill,
  cancelEWayBill,
  updateEWayBillPartB,
} from '../ecompliance.service'
import type {
  EInvoiceStatus,
  EWayBillStatus,
  EWayBillGenerateInput,
  VehicleType,
} from '../ecompliance.types'

type FetchState = 'idle' | 'loading' | 'error' | 'success'

interface EComplianceState {
  fetchState: FetchState
  fetchError: string | null
  eInvoice: EInvoiceStatus | null
  eWayBill: EWayBillStatus | null
  // Per-action loading flags
  generatingInvoice: boolean
  cancellingInvoice: boolean
  generatingEwb: boolean
  cancellingEwb: boolean
  updatingPartB: boolean
  // Actions
  generateInvoice: () => Promise<void>
  cancelInvoice: (reason: string) => Promise<void>
  generateEwb: (input: Omit<EWayBillGenerateInput, 'documentId'>) => Promise<void>
  cancelEwb: (reason: string) => Promise<void>
  updatePartB: (vehicleNumber: string, vehicleType?: VehicleType) => Promise<void>
  refresh: () => void
}

export function useECompliance(documentId: string): EComplianceState {
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [eInvoice, setEInvoice] = useState<EInvoiceStatus | null>(null)
  const [eWayBill, setEWayBill] = useState<EWayBillStatus | null>(null)

  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  const [cancellingInvoice, setCancellingInvoice] = useState(false)
  const [generatingEwb, setGeneratingEwb] = useState(false)
  const [cancellingEwb, setCancellingEwb] = useState(false)
  const [updatingPartB, setUpdatingPartB] = useState(false)

  // Ref prevents stale state in async callbacks
  const refreshCountRef = useRef(0)

  const fetchStatuses = useCallback((signal: AbortSignal) => {
    setFetchState('loading')
    setFetchError(null)

    Promise.all([
      getEInvoiceStatus(documentId, signal),
      getEWayBillStatus(documentId, signal),
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
  }, [documentId])

  useEffect(() => {
    const controller = new AbortController()
    fetchStatuses(controller.signal)
    return () => { controller.abort() }
  }, [fetchStatuses, refreshCountRef.current]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    refreshCountRef.current += 1
    // Force effect re-run by bumping counter in state
    setFetchState('idle')
  }, [])

  // Re-fetch when refresh is called (idle → triggers useEffect dependency)
  useEffect(() => {
    if (fetchState !== 'idle') return
    const controller = new AbortController()
    fetchStatuses(controller.signal)
    return () => { controller.abort() }
  }, [fetchState, fetchStatuses])

  const generateInvoice = useCallback(async () => {
    if (generatingInvoice) return
    setGeneratingInvoice(true)
    try {
      const result = await generateEInvoice(documentId)
      setEInvoice({
        irn: result.irn,
        ackNumber: result.ackNumber,
        ackDate: result.ackDate,
        qrCode: result.qrCode,
        status: 'GENERATED',
      })
    } finally {
      setGeneratingInvoice(false)
    }
  }, [documentId, generatingInvoice])

  const cancelInvoice = useCallback(async (reason: string) => {
    if (cancellingInvoice) return
    setCancellingInvoice(true)
    try {
      await cancelEInvoice(documentId, reason)
      setEInvoice(prev => prev
        ? { ...prev, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: reason }
        : prev
      )
    } finally {
      setCancellingInvoice(false)
    }
  }, [documentId, cancellingInvoice])

  const generateEwb = useCallback(async (input: Omit<EWayBillGenerateInput, 'documentId'>) => {
    if (generatingEwb) return
    setGeneratingEwb(true)
    try {
      const result = await generateEWayBill({ ...input, documentId })
      setEWayBill({
        ewbNumber: result.ewbNumber,
        ewbDate: result.ewbDate,
        validUntil: result.validUntil,
        status: 'GENERATED',
        vehicleNumber: input.vehicleNumber,
        vehicleType: input.vehicleType,
        transportMode: input.transportMode,
      })
    } finally {
      setGeneratingEwb(false)
    }
  }, [documentId, generatingEwb])

  const cancelEwb = useCallback(async (reason: string) => {
    if (cancellingEwb) return
    setCancellingEwb(true)
    try {
      await cancelEWayBill(documentId, reason)
      setEWayBill(prev => prev
        ? { ...prev, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancelReason: reason }
        : prev
      )
    } finally {
      setCancellingEwb(false)
    }
  }, [documentId, cancellingEwb])

  const updatePartB = useCallback(async (vehicleNumber: string, vehicleType?: VehicleType) => {
    if (updatingPartB) return
    setUpdatingPartB(true)
    try {
      await updateEWayBillPartB(documentId, vehicleNumber, vehicleType)
      setEWayBill(prev => prev ? { ...prev, vehicleNumber, vehicleType } : prev)
    } finally {
      setUpdatingPartB(false)
    }
  }, [documentId, updatingPartB])

  return {
    fetchState,
    fetchError,
    eInvoice,
    eWayBill,
    generatingInvoice,
    cancellingInvoice,
    generatingEwb,
    cancellingEwb,
    updatingPartB,
    generateInvoice,
    cancelInvoice,
    generateEwb,
    cancelEwb,
    updatePartB,
    refresh,
  }
}
