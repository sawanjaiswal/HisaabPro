/** useConvertOrderToInvoice — converts a READY/DELIVERED order to a SALE_INVOICE */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { convertCustomOrderToInvoice } from '../api/custom-orders.api'
import { orderQueryKeys } from './useCustomOrders'

interface ConvertVars {
  id: string
  title: string
}

export function useConvertOrderToInvoice() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, title }: ConvertVars) => convertCustomOrderToInvoice(id, title),
    onSuccess: (data, vars) => {
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(vars.id) })
      void queryClient.invalidateQueries({ queryKey: orderQueryKeys.all() })
      toast.success('Invoice created from order')
      // Gate navigate on data.id — optimistic {} return when offline
      if (data?.id) {
        navigate(`/invoices/${data.id}`)
      }
    },
    onError: () => {
      toast.error('Failed to convert to invoice')
    },
  })
}
