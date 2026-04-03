/**
 * SSE hook — connects to server event stream and auto-invalidates TanStack Query cache.
 * Mount once at app root. TanStack Query handles the actual refetching.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/app.config'

/** Map SSE entity types to query key prefixes for cache invalidation */
const ENTITY_KEY_MAP: Record<string, string[]> = {
  DOCUMENT: ['invoices'],
  PARTY: ['parties'],
  PAYMENT: ['payments'],
  PRODUCT: ['products'],
  EXPENSE: ['expenses'],
  CATEGORY: ['products'], // Categories affect product lists
  UNIT: ['units'],
  BATCH: ['batches'],
  GODOWN: ['godowns'],
  CHEQUE: ['cheques'],
  LOAN: ['loans'],
  RECURRING: ['recurring'],
  TEMPLATE: ['templates'],
  ROLE: ['settings'],
  STAFF: ['settings'],
}

export function useSSE() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const url = `${API_URL}/events/stream`
    const source = new EventSource(url, { withCredentials: true })
    sourceRef.current = source

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string
          entityType?: string
          entityId?: string
        }

        // Skip connection/heartbeat events
        if (data.type === 'CONNECTED') return

        // Extract entity type from event type (e.g., "DOCUMENT_CREATED" → "DOCUMENT")
        const entityType = data.entityType ?? data.type.split('_')[0]
        const queryPrefixes = ENTITY_KEY_MAP[entityType]

        if (queryPrefixes) {
          for (const prefix of queryPrefixes) {
            queryClient.invalidateQueries({ queryKey: [prefix] })
          }
        }

        // Always invalidate dashboard on any mutation
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      } catch {
        // Ignore malformed SSE data
      }
    }

    source.onerror = () => {
      // EventSource auto-reconnects — no manual handling needed
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [isAuthenticated, queryClient])
}
