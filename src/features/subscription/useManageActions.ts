/**
 * useManageActions — local hook bundling cancel + reactivate mutations for
 * the SubscriptionManagePage. Extracted to keep the page ≤ 250 lines.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import type { PlanTier } from './plan-limits'

export function useManageActions(plan: PlanTier) {
  const { t } = useLanguage()
  const toast = useToast()
  const qc = useQueryClient()
  const tStrings = t as unknown as Record<string, string>
  const [cancelling, setCancelling] = useState(false)
  const [reactivating, setReactivating] = useState(false)

  async function cancel() {
    setCancelling(true)
    try {
      await api('/subscription', {
        method: 'DELETE',
        entityType: 'subscription',
        entityLabel: `${plan} plan`,
      })
      await qc.invalidateQueries({ queryKey: ['subscription'] })
      toast.success(
        navigator.onLine ? tStrings.subStateCancelled : t.saveQueuedOnline,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.upgradeFailedTryAgain)
      throw err
    } finally {
      setCancelling(false)
    }
  }

  async function reactivate() {
    setReactivating(true)
    try {
      await api('/subscription/reactivate', {
        method: 'POST',
        body: JSON.stringify({}),
        entityType: 'subscription',
        entityLabel: `${plan} plan`,
      })
      await qc.invalidateQueries({ queryKey: ['subscription'] })
      toast.success(tStrings.subStateActive)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.upgradeFailedTryAgain)
    } finally {
      setReactivating(false)
    }
  }

  return { cancel, reactivate, cancelling, reactivating }
}
