/**
 * useBusinessVpa — fetches the business UPI VPA for the active business.
 *
 * Caches with cacheReads: true (safe — VPA is not PII and changes rarely).
 * Returns null while loading or when not configured.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

interface BusinessVpaResponse {
  upiVpa: string | null
}

async function fetchBusinessVpa(businessId: string): Promise<BusinessVpaResponse> {
  return api<BusinessVpaResponse>(`/businesses/${businessId}`, { cacheReads: true })
}

export function useBusinessVpa(): string | null {
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''

  const { data } = useQuery({
    queryKey: ['business', businessId, 'vpa'],
    queryFn: () => fetchBusinessVpa(businessId),
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000, // 5 min — VPA changes rarely
  })

  return data?.upiVpa ?? null
}
