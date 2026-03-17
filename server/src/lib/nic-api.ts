/**
 * NIC API Helper — E-Invoice (IRP) and E-Way Bill sandbox/mock layer.
 *
 * DEV / sandbox: returns realistic mock responses with crypto-generated IDs.
 * PROD: TODO — replace callNicIrpApi and callNicEwbApi bodies with real HTTP calls
 *       to https://einvoice1.gst.gov.in and https://ewaybillgst.gov.in respectively.
 */

import crypto from 'crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NicIrpGenerateResponse {
  irn: string           // 64-char hex hash
  ackNumber: string     // 13-digit acknowledgement number
  ackDate: Date
  qrCodeData: string    // Base64 encoded QR string (mock)
  signedInvoice: Record<string, unknown>
  rawResponse: Record<string, unknown>
}

export interface NicIrpCancelResponse {
  status: 'CANCELLED'
  cancelledAt: Date
}

export interface NicEwbGenerateResponse {
  ewbNumber: string    // 12-digit EWB number
  ewbDate: Date
  validUpto: Date
  rawResponse: Record<string, unknown>
}

export interface NicEwbCancelResponse {
  status: 'CANCELLED'
  cancelledAt: Date
}

// ─── Dev mock helpers ────────────────────────────────────────────────────────

function mockIrn(): string {
  return crypto.randomBytes(32).toString('hex')
}

function mockAckNumber(): string {
  return Array.from({ length: 13 }, () => crypto.randomInt(0, 10)).join('')
}

function mockEwbNumber(): string {
  return Array.from({ length: 12 }, () => crypto.randomInt(0, 10)).join('')
}

function mockQrCodeData(irn: string): string {
  // Real QR contains signed JWT; in mock we base64-encode a dummy payload
  return Buffer.from(JSON.stringify({ irn, ver: '1.01', typ: 'INV' })).toString('base64')
}

// ─── NIC IRP (E-Invoice) ─────────────────────────────────────────────────────

/**
 * Generate IRN via NIC IRP API.
 * In production: POST to NIC sandbox/prod endpoint with signed JSON payload.
 */
export async function callNicIrpGenerate(
  payload: Record<string, unknown>
): Promise<NicIrpGenerateResponse> {
  if (process.env.NODE_ENV === 'production') {
    // TODO: implement real NIC IRP API call
    // const res = await fetch('https://einvoice1.gst.gov.in/eicore/v1.03/Invoice', { ... })
    throw new Error('NIC IRP production API not yet implemented')
  }

  const irn = mockIrn()
  const ackNumber = mockAckNumber()
  const ackDate = new Date()

  return {
    irn,
    ackNumber,
    ackDate,
    qrCodeData: mockQrCodeData(irn),
    signedInvoice: { ...payload, irn, ackNumber, ackDate: ackDate.toISOString() },
    rawResponse: {
      Status: '1',
      InfoDtls: [{ InfCd: 'EWBPPD', Desc: 'Generated successfully (mock)' }],
      SignedInvoice: `mock.signed.${irn}`,
      QRCodeUrl: `https://einvoice1.gst.gov.in/qr/${irn}`,
    },
  }
}

/**
 * Cancel IRN via NIC IRP API.
 */
export async function callNicIrpCancel(
  _irn: string,
  _reason: string
): Promise<NicIrpCancelResponse> {
  if (process.env.NODE_ENV === 'production') {
    // TODO: implement real NIC IRP cancel API call
    throw new Error('NIC IRP cancel production API not yet implemented')
  }

  return {
    status: 'CANCELLED',
    cancelledAt: new Date(),
  }
}

// ─── NIC E-Way Bill ──────────────────────────────────────────────────────────

/**
 * Generate E-Way Bill via NIC EWB API.
 * Valid for: 1 day per 100 km (ROAD), up to 15 days for other modes.
 */
export async function callNicEwbGenerate(
  payload: Record<string, unknown>
): Promise<NicEwbGenerateResponse> {
  if (process.env.NODE_ENV === 'production') {
    // TODO: implement real NIC EWB API call
    throw new Error('NIC EWB production API not yet implemented')
  }

  const ewbNumber = mockEwbNumber()
  const ewbDate = new Date()
  const distance = (payload.distance as number) ?? 100
  // ROAD: 1 day per 100 km, min 1 day, max 15 days
  const validDays = Math.min(15, Math.max(1, Math.ceil(distance / 100)))
  const validUpto = new Date(ewbDate.getTime() + validDays * 24 * 60 * 60 * 1000)

  return {
    ewbNumber,
    ewbDate,
    validUpto,
    rawResponse: {
      status: '1',
      ewbNo: ewbNumber,
      ewbDt: ewbDate.toISOString(),
      ewbValidTill: validUpto.toISOString(),
      alert: 'Generated successfully (mock)',
    },
  }
}

/**
 * Cancel E-Way Bill via NIC EWB API.
 */
export async function callNicEwbCancel(
  _ewbNumber: string,
  _reason: string
): Promise<NicEwbCancelResponse> {
  if (process.env.NODE_ENV === 'production') {
    // TODO: implement real NIC EWB cancel API call
    throw new Error('NIC EWB cancel production API not yet implemented')
  }

  return {
    status: 'CANCELLED',
    cancelledAt: new Date(),
  }
}
