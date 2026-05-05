/**
 * GST Settings — TanStack Query hook
 *
 * useQuery key: ['gst-settings']
 * staleTime: 5 minutes
 * Mutations tolerate optimistic {} return (no field deref on response).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getGstSettings, updateGstSettings } from './gst-settings.service'
import type { GstSettings, PatchGstSettingsInput } from './gst.types'

export const GST_SETTINGS_QUERY_KEY = ['gst-settings'] as const

const DEFAULT_SETTINGS: GstSettings = {
  gstin: null,
  stateCode: null,
  gstEnabled: false,
  taxPricingMode: 'EXCLUSIVE',
  compositionScheme: false,
  compositionRate: null,
  eInvoiceEnabled: false,
  eWayBillEnabled: false,
  gstDeclarationText: null,
  turnoverSlab: null,
}

export function useGstSettings() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: GST_SETTINGS_QUERY_KEY,
    queryFn: getGstSettings,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (patch: PatchGstSettingsInput) => updateGstSettings(patch),
    onSuccess: (updated) => {
      // Tolerate optimistic {} when offline — only update cache if fields present
      if (updated && typeof updated === 'object' && 'gstEnabled' in updated) {
        queryClient.setQueryData(GST_SETTINGS_QUERY_KEY, updated)
      } else {
        queryClient.invalidateQueries({ queryKey: GST_SETTINGS_QUERY_KEY })
      }
      toast.success('GST settings saved')
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save GST settings')
    },
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: GST_SETTINGS_QUERY_KEY })
  }

  const updateGst = (patch: PatchGstSettingsInput) => mutation.mutate(patch)

  const status = query.isPending ? 'loading' as const
    : query.isError ? 'error' as const
    : 'success' as const

  return {
    settings: query.data ?? DEFAULT_SETTINGS,
    status,
    isSaving: mutation.isPending,
    refresh,
    updateGst,
  }
}
