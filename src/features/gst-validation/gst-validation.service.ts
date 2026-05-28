/**
 * GST filing-readiness API service (#144). Read-only — network-only (PII).
 */

import { api } from '@/lib/api'
import type { GstFilingReadiness } from './gst-validation.types'

export async function getFilingReadiness(
  period: string,
  returnType: 'GSTR1' | 'GSTR3B',
  signal?: AbortSignal,
): Promise<GstFilingReadiness> {
  const params = new URLSearchParams({ period, returnType })
  return api<GstFilingReadiness>(`/gst/filing-readiness?${params.toString()}`, {
    cacheReads: false,
    signal,
  })
}
