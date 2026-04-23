/** Offline Banner — Connection lost indicator + sync queue status
 *
 * Warm amber pill banner that slides in when offline.
 * Integrates SyncQueueIndicator (shown when queue has work) and
 * SyncStatusBadge (shown when idle so users always know sync health).
 * CSS-only animation, no Tailwind.
 */

import { useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus, checkOnlineNow } from '../../hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { SyncQueueIndicator } from './SyncQueueIndicator'
import { SyncStatusBadge } from './SyncStatusBadge'
import './offline-banner.css'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const queue = useSyncQueue()
  const [isChecking, setIsChecking] = useState(false)

  const handleCheckConnection = async () => {
    setIsChecking(true)
    await checkOnlineNow()
    setIsChecking(false)
  }

  // Online: show queue indicator when there's work, idle badge otherwise.
  // The Indicator already self-hides when empty, so only one is visible at a time.
  if (isOnline) {
    if (queue.hasItems || queue.isProcessing) return <SyncQueueIndicator />
    return <SyncStatusBadge />
  }

  return (
    <div role="status" aria-live="polite" className="offline-banner">
      <div className="offline-banner-content">
        <div className="offline-banner-icon" aria-hidden="true">
          <WifiOff size={16} strokeWidth={2} />
        </div>
        <div className="offline-banner-text">
          <span className="offline-banner-title">You're offline</span>
          <span className="offline-banner-subtitle">Changes saved locally</span>
        </div>
        <SyncQueueIndicator />
        <button
          onClick={handleCheckConnection}
          disabled={isChecking}
          className="offline-banner-retry"
          aria-label="Check internet connection"
          style={{ opacity: isChecking ? 0.65 : 1 }}
        >
          <RefreshCw
            size={12}
            strokeWidth={2.5}
            className={isChecking ? 'offline-banner-spin' : ''}
          />
          {isChecking ? 'Checking' : 'Retry'}
        </button>
      </div>
    </div>
  )
}
