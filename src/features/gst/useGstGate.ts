/**
 * GST Gate Hook — the one answer to "is GST on for this business?"
 *
 * Every feature that branches on GST asks here. It SUBSCRIBES to the settings
 * query rather than peeking at the cache: a cache read treats "nobody has
 * fetched this yet" as "GST is off", which on a fresh session is every screen
 * except Settings → GST — the seller taps New Invoice and the whole GST flow is
 * invisible. Same key/queryFn/staleTime as useGstSettings, so the two share one
 * cache entry and never disagree.
 */

import { useQuery } from '@tanstack/react-query'
import { getGstSettings } from './gst-settings.service'
import { GST_SETTINGS_QUERY_KEY } from './useGstSettings'
import type { GstSettings, TaxPricingMode } from './gst.types'

export interface GstGate {
  gstEnabled: boolean
  compositionScheme: boolean
  taxPricingMode: TaxPricingMode
  gstin: string | null
  /** Home state, derived by the server from the GSTIN — every intra/inter-state
   *  decision compares against it. */
  stateCode: string | null
}

export function useGstGate(): GstGate {
  const { data } = useQuery<GstSettings>({
    queryKey: GST_SETTINGS_QUERY_KEY,
    queryFn: getGstSettings,
    staleTime: 5 * 60 * 1000,
  })

  return {
    gstEnabled: data?.gstEnabled ?? false,
    compositionScheme: data?.compositionScheme ?? false,
    taxPricingMode: data?.taxPricingMode ?? 'EXCLUSIVE',
    gstin: data?.gstin ?? null,
    stateCode: data?.stateCode ?? null,
  }
}
