/**
 * Network Detection — Dual-Signal Approach
 * Adapted from DudhHisaab — changed health URL for HisaabPro
 *
 * Browser events for instant feedback + periodic HEAD /health heartbeat for accuracy.
 */

import { useState, useEffect, useRef } from 'react';

const HEARTBEAT_ONLINE_INTERVAL = 30_000;
const HEARTBEAT_OFFLINE_INTERVAL = 10_000;
const HEARTBEAT_TIMEOUT = 5_000;
const CONSECUTIVE_FAILURES_THRESHOLD = 2;

function getHealthUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname)) {
      return `http://${hostname}:4000/api/health`;
    }
    // TODO: Replace with production backend URL when deployed
    return '/api/health';
  }
  return '/api/health';
}

const HEALTH_URL = getHealthUrl();

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT);

    const response = await fetch(HEALTH_URL, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// Global state so multiple hook instances share the same heartbeat
let globalIsOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
const globalListeners = new Set<(online: boolean) => void>();
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
let consecutiveFailures = 0;
let isHeartbeatRunning = false;

let _handleOnline: (() => void) | null = null;
let _handleOffline: (() => void) | null = null;
let _handleFocus: (() => void) | null = null;
let _handleVisibilityChange: (() => void) | null = null;

function setGlobalOnline(online: boolean): void {
  if (globalIsOnline === online) return;
  globalIsOnline = online;
  globalListeners.forEach((listener) => listener(online));
}

async function runHeartbeat(): Promise<void> {
  const reachable = await checkConnectivity();

  if (reachable) {
    consecutiveFailures = 0;
    setGlobalOnline(true);
  } else {
    consecutiveFailures++;
    if (consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
      setGlobalOnline(false);
    }
  }

  scheduleNextHeartbeat();
}

function scheduleNextHeartbeat(): void {
  if (heartbeatTimer) clearTimeout(heartbeatTimer);
  const interval = globalIsOnline ? HEARTBEAT_ONLINE_INTERVAL : HEARTBEAT_OFFLINE_INTERVAL;
  heartbeatTimer = setTimeout(runHeartbeat, interval);
}

function startHeartbeat(): void {
  if (isHeartbeatRunning) return;
  isHeartbeatRunning = true;

  _handleOnline = () => {
    setGlobalOnline(true);
    consecutiveFailures = 0;
    runHeartbeat();
  };
  _handleOffline = () => {
    setGlobalOnline(false);
    consecutiveFailures = CONSECUTIVE_FAILURES_THRESHOLD;
    scheduleNextHeartbeat();
  };
  _handleFocus = () => { runHeartbeat(); };
  _handleVisibilityChange = () => {
    if (document.hidden) {
      if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null; }
    } else {
      runHeartbeat();
    }
  };

  window.addEventListener('online', _handleOnline);
  window.addEventListener('offline', _handleOffline);
  window.addEventListener('focus', _handleFocus);
  document.addEventListener('visibilitychange', _handleVisibilityChange);

  runHeartbeat();
}

function stopHeartbeat(): void {
  if (!isHeartbeatRunning) return;
  isHeartbeatRunning = false;
  if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null; }
  if (_handleOnline) window.removeEventListener('online', _handleOnline);
  if (_handleOffline) window.removeEventListener('offline', _handleOffline);
  if (_handleFocus) window.removeEventListener('focus', _handleFocus);
  if (_handleVisibilityChange) document.removeEventListener('visibilitychange', _handleVisibilityChange);
  _handleOnline = _handleOffline = _handleFocus = _handleVisibilityChange = null;
}

/**
 * Hook to detect online/offline status using dual-signal approach.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(globalIsOnline);

  useEffect(() => {
    const listener = (online: boolean) => setIsOnline(online);
    globalListeners.add(listener);

    if (globalListeners.size === 1) {
      startHeartbeat();
    }

    setIsOnline(globalIsOnline);

    return () => {
      globalListeners.delete(listener);
      if (globalListeners.size === 0) stopHeartbeat();
    };
  }, []);

  return isOnline;
}

/**
 * Hook with callbacks for online/offline transitions.
 */
export function useOnlineStatusWithCallbacks(callbacks?: {
  onOnline?: () => void;
  onOffline?: () => void;
}) {
  const isOnline = useOnlineStatus();
  const prevOnlineRef = useRef(isOnline);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (prevOnlineRef.current !== isOnline) {
      if (isOnline) {
        callbacksRef.current?.onOnline?.();
      } else {
        callbacksRef.current?.onOffline?.();
      }
      prevOnlineRef.current = isOnline;
    }
  }, [isOnline]);

  return { isOnline };
}

/**
 * Trigger an immediate connectivity check.
 */
export async function checkOnlineNow(): Promise<boolean> {
  const reachable = await checkConnectivity();
  if (reachable) {
    consecutiveFailures = 0;
    setGlobalOnline(true);
  } else {
    consecutiveFailures++;
    if (consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
      setGlobalOnline(false);
    }
  }
  return reachable;
}
