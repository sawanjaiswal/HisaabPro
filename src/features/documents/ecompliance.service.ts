/** E-Compliance service — E-Invoice and E-Way Bill API calls
 *
 * All POST/PUT mutations include replay-protection headers:
 *   X-Request-Nonce: <uuid>
 *   X-Request-Timestamp: <ms timestamp>
 *
 * GET requests use the standard api() wrapper with an optional AbortSignal
 * for cleanup in useEffect hooks.
 */

import { api } from '@/lib/api'
import type {
  EInvoiceStatus,
  EInvoiceGenerateResponse,
  EWayBillStatus,
  EWayBillGenerateResponse,
  EWayBillGenerateInput,
  VehicleType,
} from './ecompliance.types'

// ─── Replay-protection header generator ──────────────────────────────────────

function replayHeaders(): Record<string, string> {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': Date.now().toString(),
  }
}

// ─── E-Invoice ────────────────────────────────────────────────────────────────

export async function generateEInvoice(
  documentId: string
): Promise<EInvoiceGenerateResponse> {
  return api<EInvoiceGenerateResponse>('/einvoice/generate', {
    method: 'POST',
    body: JSON.stringify({ documentId }),
    headers: replayHeaders(),
    entityType: 'e-invoice',
    entityLabel: 'Generate e-invoice',
  })
}

export async function cancelEInvoice(
  documentId: string,
  reason: string
): Promise<void> {
  return api<void>('/einvoice/cancel', {
    method: 'POST',
    body: JSON.stringify({ documentId, reason }),
    headers: replayHeaders(),
    entityType: 'e-invoice',
    entityLabel: 'Cancel e-invoice',
  })
}

export async function getEInvoiceStatus(
  documentId: string,
  signal?: AbortSignal
): Promise<EInvoiceStatus> {
  return api<EInvoiceStatus>(`/einvoice/${documentId}`, { signal })
}

// ─── E-Way Bill ───────────────────────────────────────────────────────────────

export async function generateEWayBill(
  input: EWayBillGenerateInput
): Promise<EWayBillGenerateResponse> {
  return api<EWayBillGenerateResponse>('/ewaybill/generate', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    entityType: 'e-way-bill',
    entityLabel: 'Generate e-way bill',
  })
}

export async function cancelEWayBill(
  documentId: string,
  reason: string
): Promise<void> {
  return api<void>('/ewaybill/cancel', {
    method: 'POST',
    body: JSON.stringify({ documentId, reason }),
    headers: replayHeaders(),
    entityType: 'e-way-bill',
    entityLabel: 'Cancel e-way bill',
  })
}

export async function updateEWayBillPartB(
  documentId: string,
  vehicleNumber: string,
  vehicleType?: VehicleType
): Promise<void> {
  return api<void>('/ewaybill/update-partb', {
    method: 'PUT',
    body: JSON.stringify({ documentId, vehicleNumber, vehicleType }),
    headers: replayHeaders(),
    entityType: 'e-way-bill',
    entityLabel: `Update vehicle ${vehicleNumber}`,
  })
}

export async function getEWayBillStatus(
  documentId: string,
  signal?: AbortSignal
): Promise<EWayBillStatus> {
  return api<EWayBillStatus>(`/ewaybill/${documentId}`, { signal })
}
