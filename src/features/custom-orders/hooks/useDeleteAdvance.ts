/** useDeleteAdvance — mutation for deleting an advance entry from an order */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { deleteAdvance } from '../api/custom-orders.api'
import { orderQueryKeys } from './useCustomOrders'

interface DeleteAdvanceVars {
  orderId: string
  advanceId: string
  title: string
}

export function useDeleteAdvance() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ orderId, advanceId, title }: DeleteAdvanceVars) =>
      deleteAdvance(orderId, advanceId, title),
    onSuccess: (_result, vars) => {
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(vars.orderId) })
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.all() })
      toast.success('Advance removed')
    },
    onError: () => {
      toast.error('Failed to remove advance')
    },
  })
}
