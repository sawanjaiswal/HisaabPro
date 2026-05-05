/** Sync Status Icon — compact header button reflecting current sync health.
 *
 * Replaces the older SyncStatusBadge (text pill) and SyncQueueIndicator
 * (pending pill) with a single icon-only control that lives in the app
 * header. Tapping it opens SyncQueueDrawer for details. Re-renders on a
 * 30s tick so tooltip relative time stays fresh.
 */

import { useEffect, useState } from 'react'
import { CheckCircle2, WifiOff, AlertCircle, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { SyncQueueDrawer } from './SyncQueueDrawer'
import './sync-queue.css'

export function SyncStatusIcon() {
  const isOnline = useOnlineStatus()
  const queue = useSyncQueue()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [, forceTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const view = pickView({
    isOnline,
    isProcessing: queue.isProcessing,
    pending: queue.pending,
    syncing: queue.syncing,
    failed: queue.failed,
    dead: queue.dead,
    lastSyncAt: queue.lastSyncAt,
  })

  const badgeCount = queue.pending + queue.syncing + queue.dead

  return (
    <>
      <button
        type="button"
        className={`header-icon-btn sync-icon-btn sync-icon-btn--${view.tone}`}
        onClick={() => { queue.loadItems(); setDrawerOpen(true) }}
        aria-label={view.title}
        title={view.title}
      >
        {view.icon}
        {badgeCount > 0 && (
          <span className="sync-icon-dot" aria-hidden="true">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      <SyncQueueDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={queue.items}
        onRetry={queue.retry}
        onDiscard={queue.discard}
        onDiscardAllDead={queue.discardDead}
        onRefresh={queue.loadItems}
      />
    </>
  )
}

interface ViewInput {
  isOnline: boolean
  isProcessing: boolean
  pending: number
  syncing: number
  failed: number
  dead: number
  lastSyncAt: number | null
}

interface View {
  tone: 'ok' | 'offline' | 'warning' | 'error' | 'busy'
  icon: React.ReactNode
  title: string
}

function pickView(s: ViewInput): View {
  if (!s.isOnline) {
    return {
      tone: 'offline',
      icon: <WifiOff size={18} aria-hidden="true" />,
      title: 'Offline — changes will sync when you reconnect.',
    }
  }
  if (s.isProcessing || s.syncing > 0) {
    return {
      tone: 'busy',
      icon: <RefreshCw size={18} className="sync-spin" aria-hidden="true" />,
      title: `Syncing ${s.pending + s.syncing} change${s.pending + s.syncing === 1 ? '' : 's'}…`,
    }
  }
  if (s.dead > 0) {
    return {
      tone: 'error',
      icon: <AlertCircle size={18} aria-hidden="true" />,
      title: `${s.dead} change${s.dead === 1 ? '' : 's'} could not be saved. Tap to review.`,
    }
  }
  if (s.pending > 0 || s.failed > 0) {
    return {
      tone: 'warning',
      icon: <RefreshCw size={18} aria-hidden="true" />,
      title: `${s.pending + s.failed} pending — will sync on reconnect.`,
    }
  }
  return {
    tone: 'ok',
    icon: <CheckCircle2 size={18} aria-hidden="true" />,
    title: s.lastSyncAt
      ? `Synced ${relativeSince(s.lastSyncAt)}`
      : 'Up to date',
  }
}

function relativeSince(ts: number): string {
  const ms = Math.max(0, Date.now() - ts)
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
