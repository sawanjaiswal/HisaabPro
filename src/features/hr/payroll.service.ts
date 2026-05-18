/** Payroll — Phase 6 PR6 FE service layer
 *
 * Endpoints (all under /api/payroll — api() prepends API_URL):
 *
 *   POST /payroll/run/preview                        → PayrollPreviewResult
 *   POST /payroll/run/finalize (X-Idempotency-Key)   → PayrollFinalizeResult
 *   POST /payroll/run/:id/reverse (X-Idempotency-Key)→ PayrollReverseResult
 *   GET  /payroll/:id/snapshot                       → PayslipSnapshotResponse
 *
 * BE rate-limits preview at 10/min/business — caller throttles the form so
 * users don't trip 429 by accident; the React Query `useQuery` here keeps
 * `staleTime: 0` so date-changes do trigger a fresh preview (the user
 * expects fresh numbers after editing the period), but the FE form has a
 * 350ms debounce in usePayroll → usePayrollPreview.
 *
 * Mutations pass `entityType: 'payroll-run'` so the offline queue UI shows
 * "Finalizing payroll — 2026-04-01 to 2026-04-30" instead of "Offline change".
 *
 * Idempotency: the caller (mutation hook) mints a fresh UUID per attempt.
 * A network retry replays the SAME key so finalize is exactly-once even
 * over offline queue replays (matches BE idempotencyCheck middleware).
 */

import { api } from '@/lib/api'
import type {
  PayrollFinalizeRequest,
  PayrollFinalizeResult,
  PayrollPreviewRequest,
  PayrollPreviewResult,
  PayrollReverseResult,
  PayslipSnapshotResponse,
} from './payroll.types'

// ─── Preview (no idempotency — read-only, rate-limited at BE) ────────────────

/**
 * POST /payroll/run/preview — dry-run compute, no writes.
 *
 * 429 from the BE surfaces as ApiError(status=429) — the wizard's preview
 * hook catches and shows a "Too many previews — wait a minute" toast.
 *
 * `offlineQueue: false` — preview is a read-shaped POST (no DB writes;
 * the BE rate-limits at 10/min/business). Queueing makes no sense: by
 * the time the queue drains, the user has moved on and we'd be
 * computing stale numbers. Offline = surface a clear error fast.
 */
export async function previewPayroll(
  body: PayrollPreviewRequest,
  signal?: AbortSignal,
): Promise<PayrollPreviewResult> {
  return api<PayrollPreviewResult>('/payroll/run/preview', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
    offlineQueue: false,
  })
}

// ─── Finalize ────────────────────────────────────────────────────────────────

/**
 * POST /payroll/run/finalize — writes PayrollRun + N Payment + N Payroll +
 * N PayslipSnapshot + 1 AuditLog in ONE BE $transaction.
 *
 * 409 PAYROLL_PERIOD_OVERLAP on duplicate period — caller shows the
 * "This period was already finalized" toast and offers a link to the run.
 */
export async function finalizePayroll(
  body: PayrollFinalizeRequest,
  idempotencyKey: string,
): Promise<PayrollFinalizeResult> {
  return api<PayrollFinalizeResult>('/payroll/run/finalize', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'X-Idempotency-Key': idempotencyKey },
    entityType: 'payroll-run',
    entityLabel: `Payroll ${body.fromDate} to ${body.toDate}`,
  })
}

// ─── Reverse ─────────────────────────────────────────────────────────────────

/**
 * POST /payroll/run/:id/reverse — inverse-direction-same-amount payments
 * + per-payroll audit + run status REVERSED in ONE BE $transaction.
 *
 * 409 PAYROLL_ALREADY_REVERSED OR 409 PAYMENT_ALREADY_REVERSED on
 * double-reverse — both codes mean the same thing to the user. The caller
 * normalises to a single "Already reversed" toast.
 */
export async function reversePayroll(
  payrollRunId: string,
  idempotencyKey: string,
): Promise<PayrollReverseResult> {
  return api<PayrollReverseResult>(`/payroll/run/${payrollRunId}/reverse`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'X-Idempotency-Key': idempotencyKey },
    entityType: 'payroll-run',
    entityLabel: `Reverse payroll ${payrollRunId}`,
  })
}

// ─── Payslip snapshot ────────────────────────────────────────────────────────

/**
 * GET /payroll/:id/snapshot — immutable payslip JSON for one Payroll.id.
 *
 * 404 PAYROLL_NOT_FOUND when missing OR cross-tenant.
 * 404 PAYSLIP_SNAPSHOT_NOT_FOUND when run never finalized.
 *
 * NOT cached — snapshots are PII (employee name, phone, daily rate). The
 * payslip page re-fetches on every mount; React Query keeps it in memory
 * for the session.
 */
export async function getPayslipSnapshot(
  payrollId: string,
  signal?: AbortSignal,
): Promise<PayslipSnapshotResponse> {
  return api<PayslipSnapshotResponse>(`/payroll/${payrollId}/snapshot`, { signal })
}
