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
  Gstr1SummaryRes,
  Gstr1ExportRes,
  Gstr3bSummaryRes,
  Gstr3bExportRes,
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

// ─── GSTR-1 (PR 10) ──────────────────────────────────────────────────────────

/** GET /api/gst/returns/GSTR1/:period — fetch cached summary from GstReturn row */
export async function getGstr1Summary(period: string): Promise<Gstr1SummaryRes> {
  return api<Gstr1SummaryRes>(`/gst/returns/GSTR1/${period}`, { cacheReads: false })
}

// ─── GSTR-3B (PR 11) ─────────────────────────────────────────────────────────

/** GET /api/gst/returns/GSTR3B/:period — fetch cached 11-row summary */
export async function getGstr3bSummary(period: string): Promise<Gstr3bSummaryRes> {
  return api<Gstr3bSummaryRes>(`/gst/returns/GSTR3B/${period}`, { cacheReads: false })
}

/** POST /api/gst/returns/GSTR3B/:period/export — run 11-section aggregator */
export async function exportGstr3b(
  period: string,
  idempotencyKey: string,
): Promise<Gstr3bExportRes> {
  return api<Gstr3bExportRes>(`/gst/returns/GSTR3B/${period}/export`, {
    method: 'POST',
    body: JSON.stringify({ format: 'JSON' }),
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    entityType: 'gstr3b-export',
    entityLabel: period,
  })
}

/** POST /api/gst/returns/GSTR1/:period/export — run 8 builders + return NIC envelope */
export async function exportGstr1(
  period: string,
  idempotencyKey: string,
): Promise<Gstr1ExportRes> {
  return api<Gstr1ExportRes>(`/gst/returns/GSTR1/${period}/export`, {
    method: 'POST',
    body: JSON.stringify({ format: 'JSON' }),
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    entityType: 'gstr1-export',
    entityLabel: period,
  })
}
