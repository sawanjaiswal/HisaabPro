/**
 * NIC EWB auth token cache — in-memory Map, 6h TTL.
 * Separate namespace from IRP tokens: nic-ewb-token:{businessId}.
 * Stub mode short-circuits when NIC_EWB_USERNAME is absent.
 */

import logger from '../../lib/logger.js'
import { getNicEwbCreds, NicNotConfiguredError } from '../../config/secrets.nic.js'
import { EWAYBILL_ERRORS } from './ewaybill.errors.js'
import { AppError, ErrorCode } from '../../lib/errors.js'

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

interface TokenEntry {
  token: string
  expiresAt: number
}

const store = new Map<string, TokenEntry>()

export function isEwbStubMode(): boolean {
  return !process.env.NIC_EWB_USERNAME
}

/** Fetch EWB auth token — returns 'STUB_EWB_TOKEN' in stub mode. */
export async function getEwbToken(businessId: string, baseUrl: string): Promise<string> {
  if (isEwbStubMode()) return 'STUB_EWB_TOKEN'

  const key = `nic-ewb-token:${businessId}`
  const cached = store.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.token

  return fetchNewEwbToken(businessId, baseUrl)
}

/** Force invalidation on 401. */
export function invalidateEwbToken(businessId: string): void {
  store.delete(`nic-ewb-token:${businessId}`)
}

async function fetchNewEwbToken(businessId: string, baseUrl: string): Promise<string> {
  let creds: { username: string; password: string }
  try {
    creds = getNicEwbCreds()
  } catch (e) {
    if (e instanceof NicNotConfiguredError) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, 503, 'NIC EWB credentials not configured', {
        code: EWAYBILL_ERRORS.NIC_NOT_CONFIGURED,
      })
    }
    throw e
  }

  const res = await fetch(`${baseUrl}/ewayapi/v3.0/mastercode/ewb-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ UserName: creds.username, Password: creds.password }),
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    logger.error('NIC EWB auth failed', { status: res.status, businessId })
    throw new AppError(ErrorCode.INTERNAL_ERROR, 502, 'NIC EWB authentication failed', {
      code: EWAYBILL_ERRORS.NIC_AUTH_FAILED,
    })
  }

  const body = (await res.json()) as { AuthToken?: string }
  const token = body.AuthToken
  if (!token) throw new AppError(ErrorCode.INTERNAL_ERROR, 502, 'No token in NIC EWB response')

  store.set(`nic-ewb-token:${businessId}`, { token, expiresAt: Date.now() + TOKEN_TTL_MS })
  logger.info('NIC EWB token refreshed', { businessId })
  return token
}
