/** useTransitionCustomOrder — mutation for status machine transitions */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { transitionCustomOrder } from '../api/custom-orders.api'
import { orderQueryKeys } from './useCustomOrders'
import type { TransitionCustomOrderInput } from '../api/custom-orders.api.types'

interface TransitionVars {
  id: string
  data: TransitionCustomOrderInput
  title: string
}

export function useTransitionCustomOrder() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, data, title }: TransitionVars) => transitionCustomOrder(id, data, title),
    onSuccess: (_result, vars) => {
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(vars.id) })
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.all() })
      toast.success(`Status updated to ${vars.data.toStatus.replace(/_/g, ' ')}`)
    },
    onError: () => {
      toast.error('Failed to update status')
    },
  })
}
