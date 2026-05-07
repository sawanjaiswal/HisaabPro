/**
 * useNotificationStream — SSE subscription with 30s polling fallback.
 *
 * - Opens EventSource to /api/notifications/stream.
 * - On `notification:new` or `notification:read` events, invalidates
 *   the unread-count and inbox caches.
 * - After 3 consecutive SSE errors, falls back to 30s polling via
 *   setInterval, and retries SSE connection every 5 minutes.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getStreamUrl } from './notifications.service'
import { notifKeys } from './useNotifications'

const MAX_SSE_ERRORS = 3
const POLLING_INTERVAL_MS = 30_000
const SSE_RETRY_INTERVAL_MS = 5 * 60_000

export function useNotificationStream() {
  const qc = useQueryClient()
  const errorCountRef = useRef(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sseRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esRef = useRef<EventSource | null>(null)

  function invalidateCaches() {
    qc.invalidateQueries({ queryKey: notifKeys.unreadCount() })
    qc.invalidateQueries({ queryKey: notifKeys.inbox() })
  }

  function startPolling() {
    if (pollingRef.current) return
    pollingRef.current = setInterval(invalidateCaches, POLLING_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  function closeSSE() {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }

  function openSSE() {
    closeSSE()
    const url = getStreamUrl()
    const es = new EventSource(url, { withCredentials: true })
    esRef.current = es

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type: string }
        if (data.type === 'notification:new' || data.type === 'notification:read') {
          errorCountRef.current = 0
          invalidateCaches()
        }
      } catch {
        // ignore malformed frames
      }
    }

    es.onerror = () => {
      errorCountRef.current += 1
      if (errorCountRef.current >= MAX_SSE_ERRORS) {
        closeSSE()
        startPolling()
        // Retry SSE after 5 min
        if (sseRetryRef.current) clearTimeout(sseRetryRef.current)
        sseRetryRef.current = setTimeout(() => {
          stopPolling()
          errorCountRef.current = 0
          openSSE()
        }, SSE_RETRY_INTERVAL_MS)
      }
    }
  }

  useEffect(() => {
    openSSE()
    return () => {
      closeSSE()
      stopPolling()
      if (sseRetryRef.current) clearTimeout(sseRetryRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
