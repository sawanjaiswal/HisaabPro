/**
 * GST Gate Hook — app-level read of the GST settings cache
 *
 * Reads from the TanStack Query cache set by useGstSettings().
 * Every feature that needs to know "is GST on?" uses this hook.
 * No network calls — pure cache read.
 */

import { useQueryClient } from '@tanstack/react-query'
import { GST_SETTINGS_QUERY_KEY } from './useGstSettings'
import type { GstSettings, TaxPricingMode } from './gst.types'

export interface GstGate {
  gstEnabled: boolean
  compositionScheme: boolean
  taxPricingMode: TaxPricingMode
  gstin: string | null
}

export function useGstGate(): GstGate {
  const queryClient = useQueryClient()
  const cached = queryClient.getQueryData<GstSettings>(GST_SETTINGS_QUERY_KEY)

  return {
    gstEnabled: cached?.gstEnabled ?? false,
    compositionScheme: cached?.compositionScheme ?? false,
    taxPricingMode: cached?.taxPricingMode ?? 'EXCLUSIVE',
    gstin: cached?.gstin ?? null,
  }
}
