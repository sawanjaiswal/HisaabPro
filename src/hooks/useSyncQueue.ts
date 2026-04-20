/**
 * useSyncQueue — React hook for offline sync queue state
 *
 * Subscribes to queue changes via useSyncExternalStore pattern.
 * Triggers queue processing when coming back online.
 * Recovers stuck items on mount (crash recovery).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOnlineStatusWithCallbacks } from './useOnlineStatus'
import { useSubscription } from './useSubscription'
import { PLAN_HIERARCHY } from '@/features/subscription/plan-limits'
import {
  subscribe,
  getQueueCounts,
  getQueueSnapshot,
  processQueue,
  recoverStuckItems,
  reactivateBlocked,
  retryItem,
  discardItem,
  discardAllDead,
  isQueueProcessing,
} from '@/lib/offline'
import type { SyncQueueItem } from '@/lib/offline.types'

interface SyncQueueState {
  pending: number
  syncing: number
  failed: number
  dead: number
  blocked: number
  total: number
  isProcessing: boolean
}

const EMPTY_STATE: SyncQueueState = {
  pending: 0, syncing: 0, failed: 0, dead: 0, blocked: 0, total: 0, isProcessing: false,
}

export function useSyncQueue() {
  const [state, setState] = useState<SyncQueueState>(EMPTY_STATE)
  const [items, setItems] = useState<SyncQueueItem[]>([])
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    const counts = await getQueueCounts()
    if (!mountedRef.current) return
    setState({ ...counts, isProcessing: isQueueProcessing() })
  }, [])

  // Subscribe to queue changes
  useEffect(() => {
    mountedRef.current = true
    refresh()

    const unsubscribe = subscribe(() => {
      if (mountedRef.current) refresh()
    })

    // Crash recovery — reset stuck syncing items
    recoverStuckItems()

    return () => {
      mountedRef.current = false
      unsubscribe()
    }
  }, [refresh])

  // Process queue when coming online
  useOnlineStatusWithCallbacks({
    onOnline: () => {
      processQueue()
    },
  })

  // Reactivate blocked items when plan upgrades (402 items → pending)
  const { plan } = useSubscription()
  const prevPlanRef = useRef(plan)
  useEffect(() => {
    const prev = prevPlanRef.current
    if (PLAN_HIERARCHY[plan] > PLAN_HIERARCHY[prev]) {
      reactivateBlocked().then((count) => {
        if (count > 0) processQueue()
      })
    }
    prevPlanRef.current = plan
  }, [plan])

  // Load full item list on demand
  const loadItems = useCallback(async () => {
    const snapshot = await getQueueSnapshot()
    if (mountedRef.current) setItems(snapshot)
  }, [])

  const retry = useCallback(async (id: number) => {
    await retryItem(id)
    processQueue()
  }, [])

  const discard = useCallback(async (id: number) => {
    await discardItem(id)
  }, [])

  const discardDead = useCallback(async () => {
    await discardAllDead()
  }, [])

  return {
    ...state,
    items,
    loadItems,
    retry,
    discard,
    discardDead,
    /** True when there's anything to show (pending, syncing, failed, or dead) */
    hasItems: state.total > 0,
    /** True when there are dead or blocked items requiring user attention */
    needsAttention: state.dead > 0 || state.blocked > 0,
  }
}
