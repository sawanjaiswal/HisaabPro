/** useCampaignLaunch — online-only mutation with error code mapping */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { launchCampaign } from '../marketing-crud.service'
import { getMarketingErrorMessage } from '../marketing.errors'
import { campaignKeys } from './useCampaigns'

export function useCampaignLaunch() {
  const toast = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => {
      if (!navigator.onLine) {
        throw new Error('OFFLINE')
      }
      return launchCampaign(id, name)
    },
    onSuccess: (data) => {
      const count = data?.recipientCount ?? 0
      toast.success(`Campaign launched! Sending to ${count.toLocaleString('en-IN')} customers.`)
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all() })
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'OFFLINE') {
        toast.error('Campaign launch requires an internet connection.')
        return
      }
      const code = err instanceof ApiError ? (err as ApiError & { code?: string }).code : undefined
      toast.error(getMarketingErrorMessage(code ?? '', err instanceof ApiError ? err.message : 'Could not launch campaign.'))
    },
  })
}
