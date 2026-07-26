/**
 * The shop's own details, as they must appear on a POS receipt.
 *
 * Both receipt surfaces (checkout success and sale detail) previously carried a
 * `MOCK_BUSINESS` literal, so every printed slip said "My Business" and claimed
 * GST was off. The name comes from the session's active business and the GST
 * fields from `useGstGate` — the same two sources the invoice PDF uses, so a
 * receipt and an invoice for the same sale can never disagree about who issued
 * it.
 */

import { useAuth } from '@/context/AuthContext'
import { useGstGate } from '@/features/gst/useGstGate'

export interface PosBusinessInfo {
  name: string
  address?: string
  gstin?: string
  gstEnabled?: boolean
}

export function usePosBusinessInfo(): PosBusinessInfo {
  const { activeBusiness } = useAuth()
  const { gstEnabled, gstin } = useGstGate()

  return {
    // The session always carries a business on any POS route (they are behind
    // ProtectedRoute); the fallback exists so a receipt renders during the
    // first paint rather than crashing on a null.
    name: activeBusiness?.name ?? '',
    gstin: gstin ?? undefined,
    gstEnabled,
  }
}
