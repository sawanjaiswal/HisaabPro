/**
 * Offline Data Banner — adapted from DudhHisaab
 * Simplified: no syncStore/db deps yet (will be wired when offline sync is built)
 *
 * States:
 * - Online → Hidden
 * - Offline → "You're offline. Showing cached data." + Retry button
 */

import { useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus, checkOnlineNow } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckConnection = async () => {
    setIsChecking(true);
    await checkOnlineNow();
    setIsChecking(false);
  };

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg px-3 py-2.5 mb-3 mx-4"
      style={{
        backgroundColor: 'var(--color-warning-bg, #fff7ed)',
        border: '1px solid var(--color-warning-border, #fed7aa)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex-shrink-0" style={{ color: 'var(--color-warning-icon, #ea580c)' }}>
          <WifiOff className="w-4 h-4" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--color-warning-dark, #9a3412)' }}>
            You're offline
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-warning-text, #c2410c)' }}>
            Showing cached data.
          </p>
        </div>
        <button
          onClick={handleCheckConnection}
          disabled={isChecking}
          className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors active:scale-95"
          style={{
            backgroundColor: 'var(--color-warning-border, #fed7aa)',
            color: 'var(--color-warning-dark, #9a3412)',
            opacity: isChecking ? 0.65 : 1,
            border: 'none',
          }}
          aria-label="Check internet connection"
        >
          <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} strokeWidth={2.5} />
          {isChecking ? 'Checking' : 'Retry'}
        </button>
      </div>
    </div>
  );
}
