/** Sync Queue Drawer — expandable list of queued offline operations
 *
 * Shows all items with status badges, error messages, retry/discard actions.
 * Opens from SyncQueueIndicator tap.
 */

import { useEffect } from 'react'
import { Trash2, RotateCcw, CloudOff, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import type { SyncQueueItem, SyncItemStatus } from '@/lib/offline.types'
import './sync-queue.css'

interface SyncQueueDrawerProps {
  open: boolean
  onClose: () => void
  items: SyncQueueItem[]
  onRetry: (id: number) => void
  onDiscard: (id: number) => void
  onDiscardAllDead: () => void
  onRefresh: () => void
}

const STATUS_LABELS: Record<SyncItemStatus, string> = {
  pending: 'Pending',
  syncing: 'Syncing',
  failed: 'Retrying',
  dead: 'Failed',
  blocked: 'Blocked',
}

const METHOD_LABELS: Record<string, string> = {
  POST: 'Create',
  PUT: 'Update',
  PATCH: 'Update',
  DELETE: 'Delete',
}

export function SyncQueueDrawer({
  open,
  onClose,
  items,
  onRetry,
  onDiscard,
  onDiscardAllDead,
  onRefresh,
}: SyncQueueDrawerProps) {
  // Refresh items when drawer opens
  useEffect(() => {
    if (open) onRefresh()
  }, [open, onRefresh])

  const deadCount = items.filter((i) => i.status === 'dead').length

  const footer = deadCount > 0 ? (
    <button
      type="button"
      className="btn btn-ghost btn-sm sync-drawer-clear py-0"
      onClick={onDiscardAllDead}
      aria-label={`Discard all ${deadCount} failed items`}
    >
      <Trash2 size={14} aria-hidden="true" />
      Discard All Failed ({deadCount})
    </button>
  ) : undefined

  return (
    <Drawer open={open} onClose={onClose} title="Offline Queue" size="sm" footer={footer}>
      {items.length === 0 ? (
        <div className="sync-drawer-empty py-0">
          <Check size={24} aria-hidden="true" />
          <p>All changes synced</p>
        </div>
      ) : (
        <ul className="sync-drawer-list py-0" role="list" aria-label="Queued offline changes">
          {items.map((item) => (
            <li key={item.id} className={`sync-drawer-item sync-drawer-item--${item.status}`}>
              <div className="sync-drawer-item-icon py-0" aria-hidden="true">
                {item.status === 'syncing' && <Loader2 size={16} className="sync-spin" />}
                {item.status === 'pending' && <CloudOff size={16} />}
                {(item.status === 'failed' || item.status === 'dead') && <AlertTriangle size={16} />}
              </div>

              <div className="sync-drawer-item-info py-0">
                <div className="sync-drawer-item-header py-0">
                  <span className="sync-drawer-item-label py-0">{item.entityLabel}</span>
                  <span className={`sync-drawer-badge sync-drawer-badge--${item.status}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>
                <div className="sync-drawer-item-meta py-0">
                  <span className="sync-drawer-method py-0">{METHOD_LABELS[item.method] ?? item.method}</span>
                  <span className="sync-drawer-entity-type py-0">{item.entityType}</span>
                  <span className="sync-drawer-time py-0">{formatTimeAgo(item.createdAt)}</span>
                </div>
                {item.errorMessage && item.status === 'dead' && (
                  <p className="sync-drawer-item-error py-0">{item.errorMessage}</p>
                )}
              </div>

              {item.status === 'dead' && item.id != null && (() => {
                const id = item.id as number // guaranteed non-null by condition above
                return (
                  <div className="sync-drawer-item-actions py-0">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onRetry(id)}
                      aria-label={`Retry ${item.entityLabel}`}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onDiscard(id)}
                      aria-label={`Discard ${item.entityLabel}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                )
              })()}
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
