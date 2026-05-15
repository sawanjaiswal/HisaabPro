/**
 * useEntitlementToken — caches the server-signed RS256 offline JWT in IDB,
 * verifies it with the cached SPKI pubkey on read, and silently refreshes
 * every 12h while online. NEVER blocks the app — degrades to null on any
 * failure so the rest of the FE falls back to online-only.
 */

import { useEffect, useRef, useState } from 'react'
import { useSubscription } from './useSubscription'
import {
  getCachedEntitlement,
  isClockRewound,
  setCachedEntitlement,
  clearCachedEntitlement,
} from '@/features/subscription/entitlement-idb'
import { getEntitlementPubKeys } from '@/features/subscription/entitlement-pubkey-loader'
import { verifyEntitlementJwt } from '@/features/subscription/entitlement-verify.utils'
import { ENTITLEMENT_REFRESH_MS } from '@/features/subscription/subscription.constants'
import type { EntitlementClaims } from '@/features/subscription/subscription.types'

interface UseEntitlementTokenResult {
  claims: EntitlementClaims | null
  isVerifying: boolean
  isExpired: boolean
}

export function useEntitlementToken(): UseEntitlementTokenResult {
  const { offlineToken, refetch } = useSubscription()
  const [claims, setClaims] = useState<EntitlementClaims | null>(null)
  const [isVerifying, setIsVerifying] = useState(true)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // 1. On mount, try cache; fall back to fresh token from /subscription.
  useEffect(() => {
    let cancelled = false
    async function loadAndVerify() {
      setIsVerifying(true)
      try {
        const cached = await getCachedEntitlement()
        if (cached && !isClockRewound(cached)) {
          const { current, prev } = await getEntitlementPubKeys()
          for (const key of [current, prev].filter((k): k is CryptoKey => !!k)) {
            const c = await verifyEntitlementJwt(cached.token, key)
            if (c && !cancelled) {
              setClaims(c)
              break
            }
          }
        } else if (cached) {
          await clearCachedEntitlement()
        }
      } finally {
        if (!cancelled) setIsVerifying(false)
      }
    }
    void loadAndVerify()
    return () => {
      cancelled = true
    }
  }, [])

  // 2. When the server delivers a fresh offlineToken, verify + cache it.
  useEffect(() => {
    if (!offlineToken) return
    let cancelled = false
    async function ingest(tok: string) {
      const { current, prev } = await getEntitlementPubKeys()
      let next: EntitlementClaims | null = null
      for (const key of [current, prev].filter((k): k is CryptoKey => !!k)) {
        next = await verifyEntitlementJwt(tok, key)
        if (next) break
      }
      if (cancelled) return
      if (!next) return
      setClaims(next)
      await setCachedEntitlement({
        token: tok,
        exp: next.exp,
        trustedTime: next.trustedTime,
      })
    }
    void ingest(offlineToken)
    return () => {
      cancelled = true
    }
  }, [offlineToken])

  // 3. Silent refresh every 12h while the tab is alive.
  useEffect(() => {
    refreshTimer.current = setInterval(() => {
      void refetch()
    }, ENTITLEMENT_REFRESH_MS)
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [refetch])

  const isExpired = claims !== null && claims.exp * 1000 < Date.now()
  return { claims, isVerifying, isExpired }
}
