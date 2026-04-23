/** Sync Status Badge — idle "Synced X ago" / "Offline" indicator
 *
 * Companion to SyncQueueIndicator. The Indicator only shows when there's
 * pending work; this badge is *always* visible and reflects the current
 * sync state at a glance: green = synced, amber = offline, red = failed.
 *
 * Re-renders on a 30s tick so the relative time stays fresh without
 * re-running expensive subscriptions.
 */

import { useEffect, useState } from 'react'
import { CheckCircle2, WifiOff, AlertCircle, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import './sync-queue.css'

export function SyncStatusBadge() {
  const isOnline = useOnlineStatus()
  const queue = useSyncQueue()
  const [, forceTick] = useState(0)

  // Re-render every 30s so "2m ago" → "3m ago" stays fresh
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

  return (
    <span
      className={`sync-status sync-status--${view.tone}`}
      title={view.title}
      aria-label={view.title}
    >
      <span className="sync-status-icon" aria-hidden="true">{view.icon}</span>
      <span className="sync-status-text">{view.text}</span>
    </span>
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
  text: string
  title: string
}

function pickView(s: ViewInput): View {
  if (!s.isOnline) {
    return {
      tone: 'offline',
      icon: <WifiOff size={12} />,
      text: 'Offline',
      title: 'No connection — changes will sync when you reconnect.',
    }
  }
  if (s.isProcessing || s.syncing > 0) {
    return {
      tone: 'busy',
      icon: <RefreshCw size={12} className="sync-spin" />,
      text: s.pending + s.syncing > 0 ? `Syncing ${s.pending + s.syncing}` : 'Syncing',
      title: 'Sending offline changes to the server.',
    }
  }
  if (s.dead > 0) {
    return {
      tone: 'error',
      icon: <AlertCircle size={12} />,
      text: `${s.dead} failed`,
      title: 'Some changes could not be saved. Tap the queue to review.',
    }
  }
  if (s.pending > 0 || s.failed > 0) {
    return {
      tone: 'warning',
      icon: <RefreshCw size={12} />,
      text: `${s.pending + s.failed} pending`,
      title: 'Will sync on reconnect.',
    }
  }
  return {
    tone: 'ok',
    icon: <CheckCircle2 size={12} />,
    text: relativeSince(s.lastSyncAt),
    title: s.lastSyncAt
      ? `Last synced ${new Date(s.lastSyncAt).toLocaleString()}`
      : 'Up to date.',
  }
}

function relativeSince(ts: number | null): string {
  if (!ts) return 'Synced'
  const ms = Math.max(0, Date.now() - ts)
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'Synced just now'
  if (mins < 60) return `Synced ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Synced ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `Synced ${days}d ago`
}
