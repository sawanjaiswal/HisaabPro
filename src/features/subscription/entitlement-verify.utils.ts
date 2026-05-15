/**
 * entitlement-verify.utils — pure WebCrypto helpers to verify an RS256 JWT
 * against a cached SPKI public key. No network, no React.
 */

import type { EntitlementClaims } from './subscription.types'

function base64UrlToBytes(b64u: string): Uint8Array {
  const pad = b64u.length % 4 === 0 ? '' : '='.repeat(4 - (b64u.length % 4))
  const b64 = (b64u + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/** Decode + verify an RS256 JWT. Returns claims on success, null on failure. */
export async function verifyEntitlementJwt(
  token: string,
  publicKey: CryptoKey,
): Promise<EntitlementClaims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h64, p64, s64] = parts
  let header: { alg?: string; typ?: string }
  try {
    header = JSON.parse(bytesToString(base64UrlToBytes(h64)))
  } catch {
    return null
  }
  if (header.alg !== 'RS256') return null

  const sig = base64UrlToBytes(s64)
  const data = new TextEncoder().encode(`${h64}.${p64}`)

  let ok = false
  try {
    ok = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      sig as BufferSource,
      data as BufferSource,
    )
  } catch {
    return null
  }
  if (!ok) return null

  let claims: EntitlementClaims
  try {
    claims = JSON.parse(bytesToString(base64UrlToBytes(p64))) as EntitlementClaims
  } catch {
    return null
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) {
    return null
  }
  return claims
}

/** Import a PEM-encoded SPKI public key as a WebCrypto verifier key. */
export async function importEntitlementPubKey(pem: string): Promise<CryptoKey | null> {
  const stripped = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  let raw: Uint8Array
  try {
    raw = base64UrlToBytes(stripped.replace(/\+/g, '-').replace(/\//g, '_'))
  } catch {
    return null
  }
  try {
    return await crypto.subtle.importKey(
      'spki',
      raw as BufferSource,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
  } catch {
    return null
  }
}
