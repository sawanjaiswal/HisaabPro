// ─── useStorefrontSettings — TanStack Query hook ─────────────────────────────

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getStorefrontSettings, patchStorefrontSettings } from '../storefront.service'
import type { PatchSettingsPayload, SettingsStatus, SlugError } from '../storefront.types'

export const storefrontKeys = {
  all:      () => ['storefront'] as const,
  settings: () => ['storefront', 'settings'] as const,
  products: () => ['storefront', 'products'] as const,
}

export function useStorefrontSettings() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const query = useQuery({
    queryKey: storefrontKeys.settings(),
    queryFn: ({ signal }) => getStorefrontSettings(signal),
    staleTime: 60_000,
    retry: 1,
  })

  const mutation = useMutation({
    mutationFn: (payload: PatchSettingsPayload) => patchStorefrontSettings(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: storefrontKeys.settings() })
      toast.success('Storefront saved')
    },
    onError: (err) => {
      const apiErr = err instanceof ApiError ? err : null
      if (apiErr?.code === 'SLUG_TAKEN') return // handled inline
      toast.error('Failed to save storefront settings')
    },
  })

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: storefrontKeys.all() })
  }, [queryClient])

  const uiStatus: SettingsStatus = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : !query.data?.slug
        ? 'empty'
        : 'success'

  const getSlugError = useCallback((err: unknown): SlugError => {
    if (err instanceof ApiError) {
      if (err.code === 'INVALID_SLUG') return 'INVALID_SLUG'
      if (err.code === 'RESERVED_SLUG') return 'RESERVED_SLUG'
      if (err.code === 'SLUG_TAKEN') return 'SLUG_TAKEN'
    }
    return null
  }, [])

  return {
    settings: query.data ?? null,
    status: uiStatus,
    error: query.error,
    saving: mutation.isPending,
    saveError: mutation.error,
    save: mutation.mutateAsync,
    refresh,
    getSlugError,
  }
}
