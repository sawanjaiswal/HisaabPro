// ─── useStorefrontProducts — TanStack Query hook ─────────────────────────────

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import {
  getStorefrontProducts,
  addStorefrontProducts,
  deleteStorefrontProduct,
  patchStorefrontProduct,
} from '../storefront.service'
import { storefrontKeys } from './useStorefrontSettings'
import type { AddProductsPayload, PatchProductPayload, ProductsStatus } from '../storefront.types'

export function useStorefrontProducts() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const query = useQuery({
    queryKey: storefrontKeys.products(),
    queryFn: ({ signal }) => getStorefrontProducts(signal),
    staleTime: 30_000,
    retry: 1,
  })

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: storefrontKeys.products() })
  }, [queryClient])

  const addMutation = useMutation({
    mutationFn: (payload: AddProductsPayload) => addStorefrontProducts(payload),
    onSuccess: () => { invalidate(); toast.success('Products added to store') },
    onError: () => { toast.error('Failed to add products') },
  })

  const removeMutation = useMutation({
    mutationFn: ({ productId, name }: { productId: string; name: string }) =>
      deleteStorefrontProduct(productId, name),
    onSuccess: () => { invalidate(); toast.success('Product removed from store') },
    onError: () => { toast.error('Failed to remove product') },
  })

  const patchMutation = useMutation({
    mutationFn: ({
      productId,
      name,
      payload,
    }: { productId: string; name: string; payload: PatchProductPayload }) =>
      patchStorefrontProduct(productId, name, payload),
    onSuccess: () => { invalidate() },
    onError: () => { toast.error('Failed to update product') },
  })

  const uiStatus: ProductsStatus = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : (query.data?.data.length ?? 0) === 0
        ? 'empty'
        : 'success'

  return {
    products: query.data?.data ?? [],
    status: uiStatus,
    error: query.error,
    addProducts: addMutation.mutateAsync,
    removeProduct: removeMutation.mutateAsync,
    patchProduct: patchMutation.mutateAsync,
    adding: addMutation.isPending,
    removing: removeMutation.isPending,
    patching: patchMutation.isPending,
  }
}
