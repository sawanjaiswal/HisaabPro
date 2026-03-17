/** Sync Queue Indicator — shows pending/failed counts in OfflineBanner area
 *
 * Hidden when queue is empty. Shows amber for pending, red for dead items.
 * Tapping opens the SyncQueueDrawer for details.
 */

import { useState } from 'react'
import { CloudOff, AlertCircle, Loader2 } from 'lucide-react'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { SyncQueueDrawer } from './SyncQueueDrawer'
import './sync-queue.css'

export function SyncQueueIndicator() {
  const queue = useSyncQueue()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!queue.hasItems) return null

  const activeCount = queue.pending + queue.syncing
  const label = queue.isProcessing
    ? `Syncing ${activeCount}...`
    : queue.needsAttention
      ? `${queue.dead} failed`
      : `${activeCount} pending`

  return (
    <>
      <button
        type="button"
        className={`sync-indicator${queue.needsAttention ? ' sync-indicator--danger' : ''}`}
        onClick={() => { queue.loadItems(); setDrawerOpen(true) }}
        aria-label={`Sync queue: ${label}. Tap to view details.`}
      >
        <span className="sync-indicator-icon" aria-hidden="true">
          {queue.isProcessing ? (
            <Loader2 size={14} className="sync-spin" />
          ) : queue.needsAttention ? (
            <AlertCircle size={14} />
          ) : (
            <CloudOff size={14} />
          )}
        </span>
        <span className="sync-indicator-label">{label}</span>
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
