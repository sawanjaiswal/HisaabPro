/**
 * Commission #128 — Rules CRUD hook.
 *
 * Provides:
 *   - useCommissionRules({ includeInactive }) → list query
 *   - useCreateCommissionRule()               → mutation
 *   - useUpdateCommissionRule()               → mutation
 *   - useDeleteCommissionRule()               → mutation
 *
 * Cache key: queryKeys.commission.rules({ includeInactive }) — invalidated
 * by every mutation so list + form refresh together.
 *
 * S2 — rate violation comes back as ApiError with code
 * `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT`. The form maps that code to its
 * banner; this hook surfaces the raw error to onError.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import {
  createRule,
  deleteRule,
  listRules,
  updateRule,
  type ListRulesParams,
} from '../api/commission.service'
import type {
  CommissionRuleDTO,
  CommissionRuleInput,
} from '../commission.types'

interface UseCommissionRulesReturn {
  rules: CommissionRuleDTO[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useCommissionRules(
  params: ListRulesParams = {}
): UseCommissionRulesReturn {
  const q = useQuery({
    queryKey: queryKeys.commission.rules(params),
    queryFn: () => listRules(params),
    staleTime: 60_000,
  })

  return {
    rules: q.data ?? [],
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => void q.refetch(),
  }
}

interface UseCreateRuleOpts {
  onSuccess?: (rule: CommissionRuleDTO | null) => void
  onError?: (err: unknown) => void
}

export function useCreateCommissionRule(opts: UseCreateRuleOpts = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CommissionRuleInput) => createRule(input),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: queryKeys.commission.all() })
      opts.onSuccess?.(data)
    },
    onError: (err) => opts.onError?.(err),
  })
}

interface UseUpdateRuleOpts {
  onSuccess?: (rule: CommissionRuleDTO | null) => void
  onError?: (err: unknown) => void
}

export function useUpdateCommissionRule(opts: UseUpdateRuleOpts = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CommissionRuleInput> }) =>
      updateRule(id, input),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: queryKeys.commission.all() })
      opts.onSuccess?.(data)
    },
    onError: (err) => opts.onError?.(err),
  })
}

interface UseDeleteRuleOpts {
  onSuccess?: () => void
  onError?: (err: unknown) => void
}

export function useDeleteCommissionRule(opts: UseDeleteRuleOpts = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      deleteRule(id, label),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.commission.all() })
      opts.onSuccess?.()
    },
    onError: (err) => opts.onError?.(err),
  })
}
