/**
 * NIC EWB HTTP client.
 * MB-3: sanitizeNicError on every NIC error (imported from einvoice.errors).
 * MB-5: NIC_ENDPOINTS reused from einvoice.nic-client (no duplication).
 * Circuit breaker: 5 fails/60s → open 30s.
 * Stub mode: short-circuits when isEwbStubMode() is true.
 */

import crypto from 'crypto'
import logger from '../../lib/logger.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { sanitizeNicError, EWAYBILL_ERRORS } from './ewaybill.errors.js'
import { NIC_ENDPOINTS } from '../einvoice/einvoice.nic-client.js'
import { getEwbToken, invalidateEwbToken, isEwbStubMode } from './ewaybill.token-store.js'
import { getNicEnvKey } from '../../lib/env.js'

// ─── Circuit breaker ──────────────────────────────────────────────────────────

interface CbState { failures: number; openUntil: number; windowStart: number }

const CB_WINDOW_MS = 60_000
const CB_MAX_FAILS = 5
const CB_OPEN_MS = 30_000

const cbState: CbState = { failures: 0, openUntil: 0, windowStart: Date.now() }

function checkCircuit(): void {
  if (Date.now() < cbState.openUntil) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, 503, 'NIC EWB circuit breaker open', {
      code: EWAYBILL_ERRORS.NIC_CIRCUIT_OPEN,
    })
  }
  if (Date.now() - cbState.windowStart > CB_WINDOW_MS) {
    cbState.failures = 0
    cbState.windowStart = Date.now()
  }
}

function recordSuccess(): void { cbState.failures = 0 }

function recordFailure(): void {
  cbState.failures++
  if (cbState.failures >= CB_MAX_FAILS) {
    cbState.openUntil = Date.now() + CB_OPEN_MS
    logger.warn('NIC EWB circuit breaker OPEN', { openUntilMs: cbState.openUntil })
  }
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

async function nicEwbFetch(url: string, opts: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { ...opts, redirect: 'error', signal: controller.signal })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      recordFailure()
      const sanitized = sanitizeNicError(body) // MB-3
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        res.status >= 500 ? 502 : 400,
        sanitized,
        { code: EWAYBILL_ERRORS.NIC_AUTH_FAILED }
      )
    }
    recordSuccess()
    return body
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      recordFailure()
      throw new AppError(ErrorCode.INTERNAL_ERROR, 504, 'NIC EWB request timed out', {
        code: EWAYBILL_ERRORS.NIC_TIMEOUT,
      })
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ─── Stub helpers ─────────────────────────────────────────────────────────────

function stubEwbNumber(documentId: string): string {
  const hash = crypto.createHash('sha256').update(documentId).digest('hex')
  const digits = hash.replace(/[a-f]/g, () => String(Math.floor(Math.random() * 10)))
  return '12' + digits.slice(0, 10)
}

// ─── Public result types ──────────────────────────────────────────────────────

export interface EwbGenerateResult {
  ewbNumber: string
  validUpto: string  // ISO
  distance: number
}

export interface EwbPartBResult {
  success: boolean
  vehicleNumber: string
  updatedAt: string  // ISO
}

export interface EwbCancelResult {
  success: boolean
}

// ─── Client methods ───────────────────────────────────────────────────────────

export async function authenticate(businessId: string): Promise<string> {
  const nicEnv = getNicEnvKey()
  return getEwbToken(businessId, NIC_ENDPOINTS[nicEnv].ewb)
}

export async function generate(
  envelope: Record<string, unknown>,
  businessId: string,
  reqId: string
): Promise<EwbGenerateResult> {
  if (isEwbStubMode()) {
    const docId = String(envelope['docNo'] ?? reqId)
    const validUpto = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    return { ewbNumber: stubEwbNumber(docId), validUpto, distance: Number(envelope['transDistance'] ?? 0) }
  }

  checkCircuit()
  const nicEnv = getNicEnvKey()
  const baseUrl = NIC_ENDPOINTS[nicEnv].ewb
  let token = await getEwbToken(businessId, baseUrl)

  let body: Record<string, unknown>
  try {
    body = (await nicEwbFetch(`${baseUrl}/ewayapi/v3.0/ewaybill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authtoken: token, requestid: reqId },
      body: JSON.stringify(envelope),
    })) as Record<string, unknown>
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 401) {
      invalidateEwbToken(businessId)
      token = await getEwbToken(businessId, baseUrl)
      body = (await nicEwbFetch(`${baseUrl}/ewayapi/v3.0/ewaybill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authtoken: token, requestid: reqId },
        body: JSON.stringify(envelope),
      })) as Record<string, unknown>
    } else throw err
  }

  const data = (body['data'] ?? body) as Record<string, unknown>
  return {
    ewbNumber: String(data['ewbNo'] ?? ''),
    validUpto: String(data['validUpto'] ?? new Date(Date.now() + 3 * 86400_000).toISOString()),
    distance: Number(envelope['transDistance'] ?? 0),
  }
}

export async function updatePartB(
  ewbNumber: string,
  businessId: string,
  vehicleNumber: string,
  vehicleType: string,
  reqId: string
): Promise<EwbPartBResult> {
  if (isEwbStubMode()) {
    return { success: true, vehicleNumber, updatedAt: new Date().toISOString() }
  }

  checkCircuit()
  const nicEnv = getNicEnvKey()
  const baseUrl = NIC_ENDPOINTS[nicEnv].ewb
  const token = await getEwbToken(businessId, baseUrl)

  await nicEwbFetch(`${baseUrl}/ewayapi/v3.0/vehewb`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authtoken: token, requestid: reqId },
    body: JSON.stringify({ ewbNo: ewbNumber, vehicleNo: vehicleNumber, vehicleType }),
  })

  return { success: true, vehicleNumber, updatedAt: new Date().toISOString() }
}

export async function cancel(
  ewbNumber: string,
  businessId: string,
  reason: string,
  reqId: string
): Promise<EwbCancelResult> {
  if (isEwbStubMode()) return { success: true }

  checkCircuit()
  const nicEnv = getNicEnvKey()
  const baseUrl = NIC_ENDPOINTS[nicEnv].ewb
  const token = await getEwbToken(businessId, baseUrl)

  await nicEwbFetch(`${baseUrl}/ewayapi/v3.0/canceweg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authtoken: token, requestid: reqId },
    body: JSON.stringify({ ewbNo: ewbNumber, cancelRsnCode: reason }),
  })

  return { success: true }
}
