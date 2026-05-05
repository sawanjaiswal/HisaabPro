/**
 * useGstr3b — React Query hooks for GSTR-3B summary + export mutation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGstr3bSummary, exportGstr3b } from './gst-returns.service'
import type { Gstr3bExportRes } from './gst-returns.types'

export function useGstr3bSummary(period: string) {
  return useQuery({
    queryKey: ['gstr3b-summary', period],
    queryFn: () => getGstr3bSummary(period),
    staleTime: 60_000,
    enabled: !!period,
  })
}

export function useGstr3bExport() {
  const queryClient = useQueryClient()

  return useMutation<Gstr3bExportRes, Error, { period: string; idempotencyKey: string }>({
    mutationFn: ({ period, idempotencyKey }) => exportGstr3b(period, idempotencyKey),
    onSuccess: (_data, { period }) => {
      void queryClient.invalidateQueries({ queryKey: ['gstr3b-summary', period] })
    },
  })
}
