/** useMarketingTemplates — list + detail + mutations (TanStack Query) */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/lib/api'
import {
  listTemplates, getTemplate,
} from '../marketing.service'
import {
  createTemplate, updateTemplate, deleteTemplate,
} from '../marketing-crud.service'
import type {
  MarketingChannel, CreateTemplatePayload, UpdateTemplatePayload,
} from '../marketing.types'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const templateKeys = {
  all:    () => ['marketing', 'templates'] as const,
  list:   (ch?: MarketingChannel) => ['marketing', 'templates', 'list', ch] as const,
  detail: (id: string) => ['marketing', 'templates', 'detail', id] as const,
}

// ─── useMarketingTemplateList ─────────────────────────────────────────────────

export function useMarketingTemplateList(channel?: MarketingChannel) {
  const toast = useToast()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: templateKeys.list(channel),
    queryFn: ({ signal }) => listTemplates(channel, null, signal),
  })

  if (query.error && !query.isFetching) {
    const msg = query.error instanceof ApiError ? query.error.message : t.marketingLoadFailed
    toast.error(msg)
  }

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: templateKeys.all() })
  }, [queryClient])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { templates: query.data?.data ?? [], status, refresh }
}

// ─── useMarketingTemplateDetail ───────────────────────────────────────────────

export function useMarketingTemplateDetail(id: string) {
  const toast = useToast()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: ({ signal }) => getTemplate(id, signal),
    enabled: !!id,
  })

  if (query.error && !query.isFetching) {
    const msg = query.error instanceof ApiError ? query.error.message : t.marketingTemplateLoadFailed
    toast.error(msg)
  }

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: templateKeys.detail(id) })
  }, [queryClient, id])

  const status: 'loading' | 'error' | 'success' =
    query.isPending ? 'loading' : query.isError ? 'error' : 'success'

  return { template: query.data ?? null, status, refresh }
}

// ─── useCreateTemplate ────────────────────────────────────────────────────────

export function useCreateTemplate() {
  const toast = useToast()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateTemplatePayload) => createTemplate(payload),
    onSuccess: () => {
      toast.success(t.marketingTemplateSaved)
      void queryClient.invalidateQueries({ queryKey: templateKeys.all() })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : t.marketingTemplateSaveFailed
      toast.error(msg)
    },
  })
}

// ─── useUpdateTemplate ────────────────────────────────────────────────────────

export function useUpdateTemplate(id: string, name: string) {
  const toast = useToast()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateTemplatePayload) => updateTemplate(id, name, payload),
    onSuccess: () => {
      toast.success(t.marketingTemplateSaved)
      void queryClient.invalidateQueries({ queryKey: templateKeys.all() })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : t.marketingTemplateSaveFailed
      toast.error(msg)
    },
  })
}

// ─── useDeleteTemplate ────────────────────────────────────────────────────────

export function useDeleteTemplate() {
  const toast = useToast()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => deleteTemplate(id, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all() })
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : t.marketingTemplateDeleteFailed
      toast.error(msg)
    },
  })
}
