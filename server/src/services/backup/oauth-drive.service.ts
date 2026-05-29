/**
 * Audit #5 — Google Drive OAuth 2.0 (Authorization Code + PKCE S256).
 *
 * Least-privilege scope `drive.file` (app-created files only — cannot read the
 * user's existing Drive). The redirect URI is pinned from env, never derived
 * from the request. Refresh tokens are returned to the caller for encrypted
 * storage; short-lived access tokens are cached in-process per user.
 *
 * Tokens are NEVER logged. Provider errors are scrubbed before propagation.
 */

import { createHash, randomBytes } from 'crypto'
import { google } from 'googleapis'
import {
  getDriveClientId,
  getDriveClientSecret,
  getDriveRedirectUri,
} from '../../lib/env.js'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

function oauthClient() {
  return new google.auth.OAuth2(getDriveClientId(), getDriveClientSecret(), getDriveRedirectUri())
}

export interface PkcePair {
  codeVerifier: string
  codeChallenge: string
}

export function generatePkce(): PkcePair {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function newState(): string {
  return randomBytes(32).toString('base64url')
}

export function buildAuthUrl(state: string, codeChallenge: string): string {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token on every connect
    scope: [DRIVE_SCOPE],
    state,
    code_challenge_method: 'S256' as never,
    code_challenge: codeChallenge as never,
  })
}

export interface ExchangedTokens {
  refreshToken: string
  accessToken: string
  expiryDate: number // epoch ms
  email: string
  scope: string
}

/**
 * Exchange an authorization code (+ PKCE verifier) for tokens and resolve the
 * connected Google account email via the id_token / userinfo.
 */
export async function exchangeCode(code: string, codeVerifier: string): Promise<ExchangedTokens> {
  const client = oauthClient()
  try {
    const { tokens } = await client.getToken({
      code,
      codeVerifier,
    } as never)
    if (!tokens.refresh_token) {
      throw new Error('DRIVE_NO_REFRESH_TOKEN')
    }
    client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const { data } = await oauth2.userinfo.get()

    return {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? '',
      expiryDate: tokens.expiry_date ?? Date.now() + 50 * 60 * 1000,
      email: data.email ?? 'unknown',
      scope: tokens.scope ?? DRIVE_SCOPE,
    }
  } catch (err) {
    throw new Error(`DRIVE_TOKEN_EXCHANGE_FAILED: ${scrub(err)}`)
  }
}

// Short-lived in-process access-token cache (per user) — avoids a refresh call
// on every backup within the token's validity window.
const accessTokenCache = new Map<string, { token: string; exp: number }>()

/**
 * Obtain a valid access token from a stored refresh token. Cached in-process
 * until ~1 min before expiry.
 */
export async function getAccessToken(userId: string, refreshToken: string): Promise<string> {
  const cached = accessTokenCache.get(userId)
  if (cached && cached.exp > Date.now() + 60_000) return cached.token

  const client = oauthClient()
  client.setCredentials({ refresh_token: refreshToken })
  try {
    const { credentials } = await client.refreshAccessToken()
    const token = credentials.access_token ?? ''
    const exp = credentials.expiry_date ?? Date.now() + 50 * 60 * 1000
    accessTokenCache.set(userId, { token, exp })
    return token
  } catch (err) {
    accessTokenCache.delete(userId)
    throw new Error(`DRIVE_TOKEN_REFRESH_FAILED: ${scrub(err)}`)
  }
}

export function clearAccessTokenCache(userId: string): void {
  accessTokenCache.delete(userId)
}

/**
 * Best-effort token revocation at Google. Never throws — disconnect must
 * always proceed to delete the local row even if revoke fails.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const client = oauthClient()
    await client.revokeToken(refreshToken)
  } catch {
    // swallow — revoke is best-effort; caller still deletes the row
  }
}

/** Strip anything token-shaped from a provider error before it can be logged. */
function scrub(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/[A-Za-z0-9._-]{20,}/g, '[redacted]').slice(0, 200)
}
