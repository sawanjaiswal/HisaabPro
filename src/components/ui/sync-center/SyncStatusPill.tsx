import React, { useState, useEffect } from 'react'
import { SyncManager, type SyncState } from '@/sync/SyncManager'
import { RefreshCw, WifiOff, AlertCircle, CheckCircle2 } from 'lucide-react'

interface SyncStatusPillProps {
  className?: string
}

export function SyncStatusPill({ className = '' }: SyncStatusPillProps) {
  const [state, setState] = useState<SyncState>(SyncManager.getState())

  useEffect(() => {
    return SyncManager.subscribe((newState) => setState(newState))
  }, [])

  const handleManualSync = (e: React.MouseEvent) => {
    e.stopPropagation()
    SyncManager.triggerSync()
  }

  const getStatusDisplay = () => {
    if (state.status === 'OFFLINE') {
      return {
        icon: <WifiOff className="w-[18px] h-[18px] text-amber-500 dark:text-amber-400" aria-hidden="true" />,
        text: 'Offline — changes queued locally',
        badge: null,
      }
    }
    if (state.status === 'SYNCING') {
      return {
        icon: <RefreshCw className="w-[18px] h-[18px] text-emerald-500 dark:text-emerald-400 animate-spin" aria-hidden="true" />,
        text: state.pendingCount > 0 ? `Syncing (${state.pendingCount} pending)...` : 'Syncing data...',
        badge: state.pendingCount > 0 ? (state.pendingCount > 9 ? '9+' : String(state.pendingCount)) : null,
      }
    }
    if (state.status === 'ERROR') {
      return {
        icon: <AlertCircle className="w-[18px] h-[18px] text-rose-500 dark:text-rose-400" aria-hidden="true" />,
        text: 'Sync issue — tap to retry',
        badge: '!',
      }
    }
    if (state.pendingCount > 0) {
      return {
        icon: <RefreshCw className="w-[18px] h-[18px] text-amber-500 dark:text-amber-400" aria-hidden="true" />,
        text: `${state.pendingCount} pending changes`,
        badge: state.pendingCount > 9 ? '9+' : String(state.pendingCount),
      }
    }
    return {
      icon: <CheckCircle2 className="w-[18px] h-[18px] text-emerald-500 dark:text-emerald-400" aria-hidden="true" />,
      text: 'Synced with cloud',
      badge: null,
    }
  }

  const current = getStatusDisplay()

  return (
    <button
      type="button"
      onClick={handleManualSync}
      title={`${current.text} (Tap to sync)`}
      aria-label={`${current.text}. Tap to sync now.`}
      className={`sync-badge-btn relative inline-flex items-center justify-center w-10 h-10 rounded-full cursor-pointer border-none bg-transparent hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-emerald-500 ${className}`}
    >
      {current.icon}
      {current.badge !== null && (
        <span
          className="sync-badge-dot absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center leading-none pointer-events-none shadow-xs"
          aria-hidden="true"
        >
          {current.badge}
        </span>
      )}
    </button>
  )
}
