/** Offline Banner — Connection lost indicator + sync queue status
 *
 * Warm amber pill banner that slides in when offline.
 * Integrates SyncQueueIndicator to show pending offline operations.
 * CSS-only animation, no Tailwind.
 */

import { useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus, checkOnlineNow } from '../../hooks/useOnlineStatus'
import { SyncQueueIndicator } from './SyncQueueIndicator'
import './offline-banner.css'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [isChecking, setIsChecking] = useState(false)

  const handleCheckConnection = async () => {
    setIsChecking(true)
    await checkOnlineNow()
    setIsChecking(false)
  }

  // Always render SyncQueueIndicator — it handles its own visibility
  // (shows even briefly after coming back online while queue processes)
  if (isOnline) return <SyncQueueIndicator />

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
