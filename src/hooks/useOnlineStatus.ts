/**
 * Network Detection — Dual-Signal Approach
 * Adapted from HisaabPro — changed health URL for HisaabPro
 *
 * Browser events for instant feedback + periodic HEAD /health heartbeat for accuracy.
 */

import { useState, useEffect, useRef } from 'react';

const HEARTBEAT_ONLINE_INTERVAL = 30_000;
const HEARTBEAT_OFFLINE_BASE = 10_000;     // 10s starting gap when offline
const HEARTBEAT_OFFLINE_MAX  = 60_000;     // cap at 60s for long outages
const HEARTBEAT_TIMEOUT = 5_000;
const CONSECUTIVE_FAILURES_THRESHOLD = 2;

// Exponential backoff + ±20% jitter so a fleet of PWAs doesn't synchronize
// probes against /health after a shared outage recovers. Online side stays
// flat (30s) — jitter only matters while we're retrying offline.
function jitterUnit(): number {
  // Non-security randomness for heartbeat scheduling; value in [-1, 1).
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] / 0xffffffff) * 2 - 1;
}

function offlineInterval(failureStreak: number): number {
  const exp = Math.min(HEARTBEAT_OFFLINE_BASE * Math.pow(2, Math.max(0, failureStreak - 1)), HEARTBEAT_OFFLINE_MAX);
  const jitter = exp * 0.2 * jitterUnit();
  return Math.max(1_000, Math.round(exp + jitter));
}

function getHealthUrl(): string {
  // Use the configured API_URL from env (VITE_API_URL) — works in dev and production.
  // In dev: VITE_API_URL = http://localhost:4000/api → /api/health
  // In prod: VITE_API_URL = https://api.hisaabpro.in/api → /api/health
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';
  return `${base}/health`;
}

const HEALTH_URL = getHealthUrl();

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT);

    await fetch(HEALTH_URL, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);
    // The server *responded* — that means we're online, even if it's throttled (429),
    // protected (401/403), or having an internal hiccup (5xx). Only treat
    // network/timeout failures as offline. Otherwise the offline banner
    // fires for server problems and the offline-queue triggers spuriously.
    return true;
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
  const interval = globalIsOnline ? HEARTBEAT_ONLINE_INTERVAL : offlineInterval(consecutiveFailures);
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
 * Snapshot of the dual-signal online state for non-React consumers (axios
 * interceptors, queue runners). Reflects the latest heartbeat result, not just
 * navigator.onLine — so captive-wifi false positives are filtered out.
 */
export function getGlobalOnline(): boolean {
  return globalIsOnline;
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
