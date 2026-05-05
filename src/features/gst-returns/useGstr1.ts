/**
 * useGstr1 — React Query hooks for GSTR-1 summary + export mutation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGstr1Summary, exportGstr1 } from './gst-returns.service'
import type { Gstr1ExportRes } from './gst-returns.types'

export function useGstr1Summary(period: string) {
  return useQuery({
    queryKey: ['gstr1-summary', period],
    queryFn: () => getGstr1Summary(period),
    staleTime: 60_000,
    enabled: !!period,
  })
}

export function useGstr1Export() {
  const queryClient = useQueryClient()

  return useMutation<Gstr1ExportRes, Error, { period: string; idempotencyKey: string }>({
    mutationFn: ({ period, idempotencyKey }) => exportGstr1(period, idempotencyKey),
    onSuccess: (_data, { period }) => {
      void queryClient.invalidateQueries({ queryKey: ['gstr1-summary', period] })
    },
  })
}
