/**
 * entitlement-pubkey-loader — fetches the RS256 SPKI public key from the API
 * once per app boot and caches the imported CryptoKey in module memory.
 *
 * Network path uses `api()` (offline rules — no raw fetch). The server may
 * return 503 NOT_CONFIGURED when no signing key is set; we treat that as
 * "no offline verification" and the rest of the feature degrades gracefully.
 */

import { api } from '@/lib/api'
import { importEntitlementPubKey } from './entitlement-verify.utils'

interface PubkeyResponse {
  pem: string
  prevPem?: string | null
}

let _current: Promise<CryptoKey | null> | null = null
let _prev: Promise<CryptoKey | null> | null = null

async function loadKeys(): Promise<void> {
  try {
    const res = await api<PubkeyResponse>('/auth/entitlement/pubkey', {
      method: 'GET',
    })
    _current = Promise.resolve(res.pem ? importEntitlementPubKey(res.pem) : null).then(
      (k) => k,
    )
    _prev = Promise.resolve(
      res.prevPem ? importEntitlementPubKey(res.prevPem) : null,
    ).then((k) => k)
  } catch {
    _current = Promise.resolve(null)
    _prev = Promise.resolve(null)
  }
}

export async function getEntitlementPubKeys(): Promise<{
  current: CryptoKey | null
  prev: CryptoKey | null
}> {
  if (!_current) await loadKeys()
  const [current, prev] = await Promise.all([_current!, _prev ?? Promise.resolve(null)])
  return { current, prev }
}

/** Force-refresh on next call (used after key-rotation roll-out). */
export function invalidateEntitlementPubKeys(): void {
  _current = null
  _prev = null
}
