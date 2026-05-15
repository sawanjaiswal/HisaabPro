/** useCampaigns — campaign list + mutations (TanStack Query) */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import { listCampaigns, getCampaign } from '../marketing.service'
import { createCampaign, updateCampaign, cancelCampaign } from '../marketing-crud.service'
import { getMarketingErrorMessage } from '../marketing.errors'
import type { CampaignStatus, CreateCampaignPayload } from '../marketing.types'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const campaignKeys = {
  all:    () => ['marketing', 'campaigns'] as const,
  list:   (status?: CampaignStatus | '') => ['marketing', 'campaigns', 'list', status] as const,
  detail: (id: string) => ['marketing', 'campaigns', 'detail', id] as const,
}

// ─── useCampaignList ──────────────────────────────────────────────────────────

export function useCampaignList(status?: CampaignStatus | '') {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: campaignKeys.list(status),
    queryFn: ({ signal }) => listCampaigns(status, null, signal),
    staleTime: 60_000,
  })

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: campaignKeys.all() })
  }, [queryClient])

  const loadingStatus: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return {
    campaigns: query.data?.data ?? [],
    status: loadingStatus,
    error: query.error,
    refresh,
  }
}

// ─── useCreateCampaign ────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { t } = useLanguage()

  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: CreateCampaignPayload; idempotencyKey: string }) =>
      createCampaign(payload, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all() })
    },
    onError: (err) => {
      const code = err instanceof ApiError ? (err as ApiError & { code?: string }).code : undefined
      toast.error(getMarketingErrorMessage(code ?? '', err instanceof ApiError ? err.message : t.marketingCampaignLaunchFailed))
    },
  })
}

// ─── useUpdateCampaign ────────────────────────────────────────────────────────

export function useUpdateCampaign(id: string, name: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: Partial<CreateCampaignPayload>) => updateCampaign(id, name, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all() })
    },
  })
}

// ─── useCancelCampaign ────────────────────────────────────────────────────────

export function useCancelCampaign() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { t } = useLanguage()

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => cancelCampaign(id, name),
    onSuccess: () => {
      toast.success(t.marketingCampaignCancelled)
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all() })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : t.marketingCampaignCancelFailed
      toast.error(msg)
    },
  })
}

// ─── useCampaignDetail ────────────────────────────────────────────────────────

export function useCampaignDetail(id: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: ({ signal }) => getCampaign(id, signal),
    enabled: !!id,
  })

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) })
  }, [queryClient, id])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { campaign: query.data ?? null, status, error: query.error, refresh }
}
