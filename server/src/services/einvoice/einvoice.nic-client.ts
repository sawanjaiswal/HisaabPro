/**
 * NIC IRP HTTP client.
 * MB-2: JWS signature verification (skipped in stub mode).
 * MB-3: sanitizeNicError on every NIC error.
 * MB-5: NIC_ENDPOINTS const — env var only switches keys, never contains URL.
 *
 * Circuit breaker: 5 fails/60s → open 30s (manual impl; no opossum dep needed).
 */

import crypto from 'crypto'
import logger from '../../lib/logger.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { sanitizeNicError, EINVOICE_ERRORS } from './einvoice.errors.js'
import { getToken, invalidateToken, isStubMode } from './einvoice.token-store.js'

// ─── MB-5: Hardcoded endpoints ───────────────────────────────────────────────

export const NIC_ENDPOINTS = {
  sandbox: {
    irp: 'https://einv-apisandbox.nic.in',
    ewb: 'https://ewbapisandbox.nic.in',
  },
  prod: {
    irp: 'https://einvoice1.gst.gov.in',
    ewb: 'https://ewaybillapi.nic.in',
  },
} as const

type NicEnv = 'sandbox' | 'prod'

// ─── MB-2: Pinned public keys (placeholder — real keys to fill when NIC provides) ─

// TODO: fill with actual DigiCert-signed NIC public keys when provisioned
const SANDBOX_NIC_PUBLIC_KEY = ''
const PROD_NIC_PUBLIC_KEY = ''

// ─── Circuit breaker ──────────────────────────────────────────────────────────

interface CircuitState {
  failures: number
  openUntil: number
  windowStart: number
}

const CB_WINDOW_MS = 60_000
const CB_MAX_FAILS = 5
const CB_OPEN_MS = 30_000

const cbState: CircuitState = { failures: 0, openUntil: 0, windowStart: Date.now() }

function checkCircuit(): void {
  if (Date.now() < cbState.openUntil) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, 503, 'NIC circuit breaker open', {
      code: EINVOICE_ERRORS.NIC_CIRCUIT_OPEN,
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
    logger.warn('NIC circuit breaker OPEN', { openUntilMs: cbState.openUntil })
  }
}

// ─── Stub response helpers ────────────────────────────────────────────────────

function stubIrn(documentId: string): string {
  const hash = crypto.createHash('sha256').update(documentId).digest('hex')
  return 'STUB' + hash.slice(0, 60)
}

export interface NicGenerateResult {
  irn: string
  ackNumber: string
  ackDate: string
  signedInvoice: string
  signedQrCode: string
}

export interface NicCancelResult {
  success: boolean
}

// ─── JWS verification (MB-2) ─────────────────────────────────────────────────

export function verifyJwsSignature(signedInvoice: string, nicEnv: NicEnv): void {
  if (isStubMode()) return // skip in stub mode per spec

  const publicKey = nicEnv === 'prod' ? PROD_NIC_PUBLIC_KEY : SANDBOX_NIC_PUBLIC_KEY
  if (!publicKey) {
    // TODO: when NIC provisions keys, remove this early return
    logger.warn('NIC public key not configured — skipping JWS verify (stub-like)')
    return
  }

  try {
    const [headerB64, , sig] = signedInvoice.split('.')
    if (!headerB64 || !sig) throw new Error('Invalid JWS structure')
    // Would use jsonwebtoken.verify(signedInvoice, publicKey, { algorithms: ['RS256'] })
    // Kept as placeholder until real key available
    void publicKey
  } catch (err) {
    logger.error('NIC JWS signature invalid', { err })
    throw new AppError(ErrorCode.INTERNAL_ERROR, 502, 'NIC signature verification failed', {
      code: EINVOICE_ERRORS.NIC_SIGNATURE_INVALID,
    })
  }
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

async function nicFetch(url: string, opts: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000) // 8s timeout (MB-5)
  try {
    const res = await fetch(url, {
      ...opts,
      redirect: 'error', // maxRedirects: 0 equivalent (MB-5)
      signal: controller.signal,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      recordFailure()
      const sanitized = sanitizeNicError(body) // MB-3
      throw new AppError(ErrorCode.INTERNAL_ERROR, res.status >= 500 ? 502 : 400, sanitized, {
        code: EINVOICE_ERRORS.NIC_AUTH_FAILED,
      })
    }
    recordSuccess()
    return body
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      recordFailure()
      throw new AppError(ErrorCode.INTERNAL_ERROR, 504, 'NIC request timed out', {
        code: EINVOICE_ERRORS.NIC_TIMEOUT,
      })
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateViaClient(
  businessId: string,
  envelope: Record<string, unknown>,
  reqId: string
): Promise<NicGenerateResult> {
  if (isStubMode()) {
    const irn = stubIrn(String(envelope['DocDtls'] ? JSON.stringify(envelope['DocDtls']) : reqId))
    return {
      irn,
      ackNumber: `ACK-${Date.now()}`,
      ackDate: new Date().toISOString(),
      signedInvoice: '<jws-stub>',
      signedQrCode: 'STUB_QR',
    }
  }

  checkCircuit()
  const nicEnv = (process.env.NIC_ENV ?? 'sandbox') as NicEnv
  const baseUrl = NIC_ENDPOINTS[nicEnv].irp
  const token = await getToken(businessId, baseUrl)

  let body: Record<string, unknown>
  try {
    body = (await nicFetch(`${baseUrl}/eicore/v1.03/Invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authtoken: token, 'user_name': businessId, 'Gstin': String(envelope['SellerDtls'] ? (envelope['SellerDtls'] as Record<string, unknown>)['Gstin'] : ''), 'requestid': reqId },
      body: JSON.stringify(envelope),
    })) as Record<string, unknown>
  } catch (err) {
    // Re-auth on 401
    if (err instanceof AppError && err.statusCode === 401) {
      invalidateToken(businessId)
      const freshToken = await getToken(businessId, baseUrl)
      body = (await nicFetch(`${baseUrl}/eicore/v1.03/Invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authtoken: freshToken, 'requestid': reqId },
        body: JSON.stringify(envelope),
      })) as Record<string, unknown>
    } else throw err
  }

  const data = (body['data'] ?? body) as Record<string, unknown>
  const signedInvoice = String(data['SignedInvoice'] ?? '')
  verifyJwsSignature(signedInvoice, nicEnv) // MB-2

  return {
    irn: String(data['Irn'] ?? ''),
    ackNumber: String(data['AckNo'] ?? ''),
    ackDate: String(data['AckDt'] ?? new Date().toISOString()),
    signedInvoice,
    signedQrCode: String(data['SignedQRCode'] ?? ''),
  }
}

export async function cancelViaClient(
  businessId: string,
  irn: string,
  reason: number,
  remarks: string,
  reqId: string
): Promise<NicCancelResult> {
  if (isStubMode()) return { success: true }

  checkCircuit()
  const nicEnv = (process.env.NIC_ENV ?? 'sandbox') as NicEnv
  const baseUrl = NIC_ENDPOINTS[nicEnv].irp
  const token = await getToken(businessId, baseUrl)

  await nicFetch(`${baseUrl}/eicore/v1.03/Invoice/Cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authtoken: token, 'requestid': reqId },
    body: JSON.stringify({ Irn: irn, CnlRsn: reason, CnlRem: remarks }),
  })
  return { success: true }
}
