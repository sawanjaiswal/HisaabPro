/** useConvertJobToInvoice — converts a COMPLETED job to a SALE_INVOICE */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { convertJobToInvoice } from '../api/jobs.api'
import { jobQueryKeys } from './useJobs'

interface ConvertVars {
  id: string
  title: string
}

export function useConvertJobToInvoice() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ id, title }: ConvertVars) => convertJobToInvoice(id, title),
    onSuccess: (data, vars) => {
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(vars.id) })
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.all() })
      toast.success('Invoice created from job')
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
