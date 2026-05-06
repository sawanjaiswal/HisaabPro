/**
 * E-Way Bill API service — NIC requires online.
 * Pre-checks navigator.onLine; no entityType (not queued offline).
 */

import { api } from '@/lib/api'
import type { EWayBillRecord, GenerateEWBInput, UpdatePartBInput, CancelEWBInput } from './e-way-bill.types'

function requireOnline(): void {
  if (!navigator.onLine) {
    throw new Error('E-Way Bill requires an internet connection. Please go online and try again.')
  }
}

export async function generateEWayBill(input: GenerateEWBInput): Promise<EWayBillRecord> {
  requireOnline()
  return api<EWayBillRecord>('/ewaybill/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updatePartB(input: UpdatePartBInput): Promise<EWayBillRecord> {
  requireOnline()
  return api<EWayBillRecord>('/ewaybill/update-partb', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function cancelEWayBill(input: CancelEWBInput): Promise<EWayBillRecord> {
  requireOnline()
  return api<EWayBillRecord>('/ewaybill/cancel', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getEWayBill(documentId: string): Promise<EWayBillRecord> {
  return api<EWayBillRecord>(`/ewaybill/${documentId}`, { cacheReads: true })
}
