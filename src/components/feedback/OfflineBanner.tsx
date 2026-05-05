/** Offline Banner — Connection lost indicator
 *
 * Warm amber pill banner that slides in when offline. Sync state in the
 * online case is handled by <SyncStatusIcon /> in the app header.
 * CSS-only animation, no Tailwind.
 */

import { useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus, checkOnlineNow } from '../../hooks/useOnlineStatus'
import './offline-banner.css'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [isChecking, setIsChecking] = useState(false)

  const handleCheckConnection = async () => {
    setIsChecking(true)
    await checkOnlineNow()
    setIsChecking(false)
  }

  if (isOnline) return null

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
