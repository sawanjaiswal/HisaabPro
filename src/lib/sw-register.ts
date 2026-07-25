/**
 * Service Worker Registration + Update Prompt
 *
 * Uses vite-plugin-pwa's virtual module for registration.
 * Exposes update state for the UI to show an "Update Available" prompt.
 */

import { registerSW } from 'virtual:pwa-register'

type SWUpdateListener = (needRefresh: boolean) => void

const listeners = new Set<SWUpdateListener>()
let pendingUpdate = false
let updateFn: (() => Promise<void>) | null = null

/**
 * Subscribe to SW update state changes.
 * Returns unsubscribe function.
 */
export function subscribeToSWUpdates(listener: SWUpdateListener): () => void {
  listeners.add(listener)
  // Immediately notify if there's already a pending update
  if (pendingUpdate) listener(true)
  return () => { listeners.delete(listener) }
}

/** Check if there's a pending SW update */
export function hasPendingUpdate(): boolean {
  return pendingUpdate
}

/** Accept the pending update and reload */
export async function acceptUpdate(): Promise<void> {
  if (updateFn) {
    await updateFn()
  }
}

function notifyListeners(needRefresh: boolean): void {
  pendingUpdate = needRefresh
  listeners.forEach((fn) => fn(needRefresh))
}

/**
 * Register the service worker.
 * Call once from main.tsx.
 */
export function initServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  // Dev self-heal: a SW registered by an earlier `vite preview` / Capacitor
  // build lingers on localhost and serves a cached index.html whose hashed
  // chunk URLs no longer exist under `vite dev` → blank/white tab. Tear any
  // stale registration (and its caches) down so dev never boots governed by
  // an old worker. registerSW is a no-op in dev anyway (no devOptions), so
  // there is nothing to register here.
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister())
    })
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
    }
    return
  }

  const update = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      // Check for updates every 60 minutes.
      // Intentional app-lifetime interval — not a leak. SW registration is a
      // singleton called once from main.tsx; the interval runs until page unload.
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    },
    onNeedRefresh() {
      notifyListeners(true)
    },
    onOfflineReady() {
      // App is cached and ready for offline use — no action needed
    },
  })

  updateFn = update
}
