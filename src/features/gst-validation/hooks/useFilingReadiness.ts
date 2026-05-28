import { useQuery } from '@tanstack/react-query'
import { getFilingReadiness } from '../gst-validation.service'
import { gstValidationKeys } from '../gst-validation.constants'

export function useFilingReadiness(period: string, returnType: 'GSTR1' | 'GSTR3B') {
  return useQuery({
    queryKey: gstValidationKeys.readiness(period, returnType),
    queryFn: ({ signal }) => getFilingReadiness(period, returnType, signal),
    staleTime: 60_000,
    enabled: /^\d{4}-\d{2}$/.test(period),
  })
}
