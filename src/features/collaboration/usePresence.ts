// #150 usePresence — keeps the current user "present" on an entity and returns
// the live peer list. The TanStack query's refetchInterval doubles as the
// heartbeat (each refetch POSTs /heartbeat and returns fresh peers); SSE
// PRESENCE_* events invalidate ['presence'] to refresh between beats.
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sendHeartbeat, leavePresence } from './presence.service'
import { HEARTBEAT_INTERVAL_MS } from './collaboration.constants'
import type { PresenceEntityType, PresenceMode, Peer } from './collaboration.types'

interface UsePresenceResult {
  peers: Peer[]
  /** True when at least one other user is editing the same entity. */
  someoneEditing: boolean
}

export function usePresence(
  entityType: PresenceEntityType,
  entityId: string | undefined,
  mode: PresenceMode,
): UsePresenceResult {
  const enabled = Boolean(entityId)

  const { data } = useQuery({
    queryKey: ['presence', entityType, entityId, mode],
    queryFn: () => sendHeartbeat(entityType, entityId as string, mode),
    enabled,
    refetchInterval: HEARTBEAT_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
  })

  // Drop presence when the tab closes / backgrounds or the component unmounts.
  // visibilitychange + pagehide cover mobile (Capacitor) backgrounding where a
  // plain unmount never fires (architecture-critique S4).
  useEffect(() => {
    if (!enabled) return
    const drop = () => {
      void leavePresence()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') drop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', drop)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', drop)
      drop()
    }
  }, [enabled, entityType, entityId])

  const peers = data?.peers ?? []
  return { peers, someoneEditing: peers.some((p) => p.mode === 'editing') }
}
