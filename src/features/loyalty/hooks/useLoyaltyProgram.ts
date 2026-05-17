/**
 * Loyalty #125 — Program hook (read + upsert).
 *
 * Cache key: queryKeys.loyalty.program() — invalidated by the mutation so
 * every PartyDetail tab gate / settings page refreshes after a save.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { getProgram, updateProgram } from '../api/loyalty.service'
import type { LoyaltyProgramDTO, LoyaltyProgramInput } from '../loyalty.types'

interface UseLoyaltyProgramReturn {
  program: LoyaltyProgramDTO | null
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useLoyaltyProgram(): UseLoyaltyProgramReturn {
  const q = useQuery({
    queryKey: queryKeys.loyalty.program(),
    queryFn: getProgram,
    staleTime: 60_000, // small static-ish payload
  })

  return {
    program: q.data ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => void q.refetch(),
  }
}

interface UseUpdateProgramOptions {
  onSuccess?: (program: LoyaltyProgramDTO | null) => void
  onError?: (err: unknown) => void
}

export function useUpdateLoyaltyProgram(opts: UseUpdateProgramOptions = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: LoyaltyProgramInput) => updateProgram(input),
    onSuccess: (data) => {
      // Refresh program everywhere — settings page + PartyDetail tab gate.
      void qc.invalidateQueries({ queryKey: queryKeys.loyalty.all() })
      opts.onSuccess?.(data)
    },
    onError: (err) => {
      opts.onError?.(err)
    },
  })
}
