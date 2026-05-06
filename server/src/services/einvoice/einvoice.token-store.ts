/**
 * NIC IRP auth token cache — in-memory Map, 6h TTL.
 * Re-auths on 401 (once). Stub mode short-circuits.
 */

import logger from '../../lib/logger.js'
import { getNicIrpCreds, NicNotConfiguredError } from '../../config/secrets.nic.js'
import { EINVOICE_ERRORS } from './einvoice.errors.js'
import { AppError, ErrorCode } from '../../lib/errors.js'

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

interface TokenEntry {
  token: string
  expiresAt: number
}

const store = new Map<string, TokenEntry>()

export function isStubMode(): boolean {
  return !process.env.NIC_IRP_USERNAME
}

/** Fetch auth token — returns 'STUB_TOKEN' in stub mode. */
export async function getToken(businessId: string, baseUrl: string): Promise<string> {
  if (isStubMode()) return 'STUB_TOKEN'

  const key = `nic-irp-token:${businessId}`
  const cached = store.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.token

  return await fetchNewToken(businessId, baseUrl)
}

/** Force invalidation (call on 401 response). */
export function invalidateToken(businessId: string): void {
  store.delete(`nic-irp-token:${businessId}`)
}

async function fetchNewToken(businessId: string, baseUrl: string): Promise<string> {
  let creds: { username: string; password: string }
  try {
    creds = getNicIrpCreds()
  } catch (e) {
    if (e instanceof NicNotConfiguredError) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, 503, 'NIC credentials not configured', {
        code: EINVOICE_ERRORS.NIC_NOT_CONFIGURED,
      })
    }
    throw e
  }

  const res = await fetch(`${baseUrl}/eivital/v1.04/Master/Authentication`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ UserName: creds.username, Password: creds.password, AppKey: '', ForceRefreshAccessToken: true }),
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    logger.error('NIC auth failed', { status: res.status, businessId })
    throw new AppError(ErrorCode.INTERNAL_ERROR, 502, 'NIC authentication failed', {
      code: EINVOICE_ERRORS.NIC_AUTH_FAILED,
    })
  }

  const body = (await res.json()) as { AuthToken?: string; TokenExpiry?: string }
  const token = body.AuthToken
  if (!token) throw new AppError(ErrorCode.INTERNAL_ERROR, 502, 'No token in NIC response')

  store.set(`nic-irp-token:${businessId}`, { token, expiresAt: Date.now() + TOKEN_TTL_MS })
  logger.info('NIC token refreshed', { businessId })
  return token
}
