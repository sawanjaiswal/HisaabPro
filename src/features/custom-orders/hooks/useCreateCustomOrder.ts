/** useCreateCustomOrder — mutation for creating a new custom order */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { createCustomOrder } from '../api/custom-orders.api'
import { orderQueryKeys } from './useCustomOrders'
import type { CreateCustomOrderInput } from '../api/custom-orders.api.types'

export function useCreateCustomOrder() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (data: CreateCustomOrderInput) => createCustomOrder(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.all() })
      toast.success('Order created')
    },
    onError: () => {
      toast.error('Failed to create order')
    },
  })
}
