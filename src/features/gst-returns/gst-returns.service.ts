/**
 * GST Backfill — API service layer
 *
 * All calls via api() — no raw fetch.
 * Mutations carry entityType + entityLabel for offline queue UI.
 */

import { api } from '@/lib/api'
import type {
  BackfillPreviewRes,
  BackfillExecutePayload,
  BackfillExecuteRes,
  BackfillStatusRes,
} from './gst-returns.types'

/** POST /api/gst/backfill/preview — dry run, no writes */
export async function previewBackfill(): Promise<BackfillPreviewRes> {
  return api<BackfillPreviewRes>('/gst/backfill/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    entityType: 'gst-backfill',
    entityLabel: 'Backfill preview',
  })
}

/** POST /api/gst/backfill/execute — starts the backfill job */
export async function executeBackfill(
  payload: BackfillExecutePayload,
  idempotencyKey: string,
): Promise<BackfillExecuteRes> {
  return api<BackfillExecuteRes>('/gst/backfill/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    entityType: 'gst-backfill',
    entityLabel: 'Backfill job',
  })
}

/** GET /api/gst/backfill/status/:jobId — poll for progress */
export async function getBackfillStatus(jobId: string): Promise<BackfillStatusRes> {
  return api<BackfillStatusRes>(`/gst/backfill/status/${jobId}`)
}
