/** Tax — GST Settings hook (TanStack Query) */

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

const GST_SETTINGS_KEY = (businessId: string) => ['gst-settings', businessId] as const

export function useGstSettings(businessId: string) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: GST_SETTINGS_KEY(businessId),
    queryFn: ({ signal }) =>
      api<GstSettings>(`/businesses/${businessId}/gst-settings`, { signal }),
    enabled: Boolean(businessId),
  })

  useEffect(() => {
    if (query.isError) {
      const err = query.error
      toast.error(err instanceof ApiError ? err.message : 'Failed to load GST settings')
    }
  }, [query.isError, query.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateMutation = useMutation({
    mutationFn: (data: Partial<GstSettings>) =>
      api<GstSettings>(`/businesses/${businessId}/gst-settings`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(GST_SETTINGS_KEY(businessId), updated)
      toast.success('GST settings updated')
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update')
    },
  })

  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: GST_SETTINGS_KEY(businessId) })
  }

  const updateGst = async (data: Partial<GstSettings>) => {
    await updateMutation.mutateAsync(data)
  }

  return { settings: query.data ?? { gstin: null, stateCode: null, compositionScheme: false, eInvoiceEnabled: false, eWayBillEnabled: false }, status, refresh, updateGst }
}
