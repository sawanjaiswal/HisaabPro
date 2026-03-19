/** Tax — GST Settings hook */

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError, api } from '@/lib/api'

export interface GstSettings {
  gstin: string | null
  stateCode: string | null
  compositionScheme: boolean
  eInvoiceEnabled: boolean
  eWayBillEnabled: boolean
}

type Status = 'loading' | 'error' | 'success'

const EMPTY: GstSettings = {
  gstin: null, stateCode: null,
  compositionScheme: false, eInvoiceEnabled: false, eWayBillEnabled: false,
}

export function useGstSettings(businessId: string) {
  const toast = useToast()
  const [settings, setSettings] = useState<GstSettings>(EMPTY)
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!businessId) return
    const controller = new AbortController()
    setStatus('loading')
    api<GstSettings>(`/businesses/${businessId}/gst-settings`, { signal: controller.signal })
      .then((data) => { setSettings(data); setStatus('success') })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        toast.error(err instanceof ApiError ? err.message : 'Failed to load GST settings')
      })
    return () => controller.abort()
  }, [businessId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const updateGst = useCallback(async (data: Partial<GstSettings>) => {
    try {
      const updated = await api<GstSettings>(`/businesses/${businessId}/gst-settings`, {
        method: 'PUT', body: JSON.stringify(data),
      })
      setSettings(updated)
      toast.success('GST settings updated')
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update')
    }
  }, [businessId, toast])

  return { settings, status, refresh, updateGst }
}
