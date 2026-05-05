/** useUpdateCustomOrder — mutation for patching an existing custom order */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { updateCustomOrder } from '../api/custom-orders.api'
import { orderQueryKeys } from './useCustomOrders'
import type { UpdateCustomOrderInput } from '../api/custom-orders.api.types'

interface UpdateOrderVars {
  id: string
  data: UpdateCustomOrderInput
  title: string
}

export function useUpdateCustomOrder() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, data, title }: UpdateOrderVars) => updateCustomOrder(id, data, title),
    onSuccess: (_result, vars) => {
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(vars.id) })
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.all() })
      toast.success('Order updated')
    },
    onError: () => {
      toast.error('Failed to update order')
    },
  })
}
