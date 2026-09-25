import React, { useState, useEffect } from 'react';
import { SyncManager, SyncState } from '@/sync/SyncManager';
import { RefreshCw, WifiOff, AlertCircle, CheckCircle2 } from 'lucide-react';

export function SyncStatusPill() {
  const [state, setState] = useState<SyncState>(SyncManager.getState());

  useEffect(() => {
    return SyncManager.subscribe((newState) => setState(newState));
  }, []);

  const handleManualSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    SyncManager.triggerSync();
  };

  const getStatusDisplay = () => {
    if (state.status === 'OFFLINE') {
      return {
        bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        icon: <WifiOff className="w-3.5 h-3.5 mr-1 text-amber-600" />,
        text: 'Offline',
      };
    }
    if (state.status === 'SYNCING') {
      return {
        bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        icon: <RefreshCw className="w-3.5 h-3.5 mr-1 text-emerald-600 animate-spin" />,
        text: state.pendingCount > 0 ? `Syncing (${state.pendingCount})` : 'Syncing...',
      };
    }
    if (state.status === 'ERROR') {
      return {
        bg: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        icon: <AlertCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />,
        text: 'Sync Issue',
      };
    }
    if (state.pendingCount > 0) {
      return {
        bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        icon: <RefreshCw className="w-3.5 h-3.5 mr-1 text-amber-600" />,
        text: `${state.pendingCount} Pending`,
      };
    }
    return {
      bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />,
      text: 'Synced',
    };
  };

  const current = getStatusDisplay();

  return (
    <div
      onClick={handleManualSync}
      title="Click to sync data with server"
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer select-none transition-all duration-200 hover:scale-105 active:scale-95 ${current.bg}`}
    >
      {current.icon}
      <span>{current.text}</span>
    </div>
  );
}
