/** useInventorySettings — fetch + update Business inventory fields (BAT-07) */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'

export type ExpiredBatchPolicy = 'WARN_ONLY' | 'HARD_BLOCK'

interface BusinessInventorySettings {
  expiryAlertDays: number | null
  expiredBatchPolicy: string | null
}

interface UpdatePayload {
  expiryAlertDays: number
  expiredBatchPolicy: ExpiredBatchPolicy
}

async function fetchSettings(businessId: string): Promise<BusinessInventorySettings> {
  return api<BusinessInventorySettings>(`/businesses/${businessId}`, { cacheReads: true })
}

async function updateSettings(businessId: string, data: UpdatePayload): Promise<void> {
  return api<void>(`/businesses/${businessId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    entityType: 'business',
    entityLabel: 'inventory_settings',
  })
}

export function useInventorySettings() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()
  const businessId = user?.businessId ?? ''

  const [alertDays, setAlertDays] = useState<number>(30)
  const [policy, setPolicy] = useState<ExpiredBatchPolicy>('WARN_ONLY')
  const [initialized, setInitialized] = useState(false)

  const { data, status, refetch } = useQuery({
    queryKey: ['business', businessId, 'inventory-settings'],
    queryFn: () => fetchSettings(businessId),
    enabled: !!businessId,
  })

  useEffect(() => {
    if (data && !initialized) {
      setAlertDays(data.expiryAlertDays ?? 30)
      setPolicy((data.expiredBatchPolicy as ExpiredBatchPolicy) ?? 'WARN_ONLY')
      setInitialized(true)
    }
  }, [data, initialized])

  const mutation = useMutation({
    mutationFn: (payload: UpdatePayload) => updateSettings(businessId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', businessId] })
      if (navigator.onLine) {
        toast.success(t.inventorySettingsSaved)
      } else {
        toast.info(t.inventorySettingsSavedOffline)
      }
    },
    onError: () => {
      toast.error(t.couldNotLoadInventorySettings)
    },
  })

  function save() {
    mutation.mutate({ expiryAlertDays: alertDays, expiredBatchPolicy: policy })
  }

  return {
    alertDays,
    setAlertDays,
    policy,
    setPolicy,
    initialized,
    status,
    refetch,
    save,
    isSaving: mutation.isPending,
  }
}
