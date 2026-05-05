/** useRecordAdvance — mutation for recording an advance payment on an order */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { recordAdvance } from '../api/custom-orders.api'
import { orderQueryKeys } from './useCustomOrders'
import type { RecordAdvanceInput } from '../api/custom-orders.api.types'

interface RecordAdvanceVars {
  orderId: string
  data: RecordAdvanceInput
  title: string
}

export function useRecordAdvance() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ orderId, data, title }: RecordAdvanceVars) =>
      recordAdvance(orderId, data, title),
    onSuccess: (_result, vars) => {
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(vars.orderId) })
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.all() })
      toast.success('Advance recorded')
    },
    onError: () => {
      toast.error('Failed to record advance')
    },
  })
}
