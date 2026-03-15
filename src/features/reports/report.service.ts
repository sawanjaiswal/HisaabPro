/** Reports — API service layer
 *
 * All monetary values are in PAISE (integer) — server and client both use paise.
 * Display conversion is done at the component layer via formatAmount().
 *
 * API base: the `api()` helper already prepends API_URL, so paths start at /
 * (not /api). Server routes are mounted at /reports.
 *
 * Every fetch accepts an AbortSignal so the calling hook can cancel on cleanup,
 * preventing stale responses from corrupting state (RESILIENCE_RULES).
 */

import { api } from '@/lib/api'
import { buildQueryString } from './report.utils'
import type {
  InvoiceReportFilters,
  InvoiceReportResponse,
  PartyStatementFilters,
  PartyStatementResponse,
  StockSummaryFilters,
  StockSummaryResponse,
  DayBookFilters,
  DayBookResponse,
  PaymentHistoryFilters,
  PaymentHistoryResponse,
  ExportRequest,
  ExportResponse,
} from './report.types'

// ─── Invoice Report (Sale / Purchase) ─────────────────────────────────────────

/**
 * Fetch paginated invoice report data.
 *
 * The `type` field in filters determines whether this is a sale or purchase
 * report. Supports flat list (groupBy: 'none') and grouped views.
 */
export async function getInvoiceReport(
  filters: InvoiceReportFilters,
  signal?: AbortSignal
): Promise<InvoiceReportResponse> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<InvoiceReportResponse>(`/reports/invoices?${query}`, { signal })
}

// ─── Party Statement ───────────────────────────────────────────────────────────

/**
 * Fetch ledger statement for a single party.
 *
 * Returns all transactions (invoices, payments, credit/debit notes) with
 * running balance. partyId is a path parameter.
 */
export async function getPartyStatement(
  partyId: string,
  filters: PartyStatementFilters,
  signal?: AbortSignal
): Promise<PartyStatementResponse> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<PartyStatementResponse>(
    `/reports/party-statement/${partyId}?${query}`,
    { signal }
  )
}

// ─── Stock Summary ─────────────────────────────────────────────────────────────

/**
 * Fetch paginated stock summary with current levels and values.
 *
 * Supports filtering by category, stock status, and full-text search.
 */
export async function getStockSummary(
  filters: StockSummaryFilters,
  signal?: AbortSignal
): Promise<StockSummaryResponse> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<StockSummaryResponse>(`/reports/stock-summary?${query}`, { signal })
}

// ─── Day Book ──────────────────────────────────────────────────────────────────

/**
 * Fetch all transactions for a given date, grouped by type in the summary.
 *
 * The response includes prev/next date navigation links and a net cash flow
 * calculation for the day.
 */
export async function getDayBook(
  filters: DayBookFilters,
  signal?: AbortSignal
): Promise<DayBookResponse> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<DayBookResponse>(`/reports/day-book?${query}`, { signal })
}

// ─── Payment History ───────────────────────────────────────────────────────────

/**
 * Fetch paginated payment history with optional grouping by day, party, or mode.
 *
 * Supports filtering by direction (in/out), payment mode, and party.
 */
export async function getPaymentHistory(
  filters: PaymentHistoryFilters,
  signal?: AbortSignal
): Promise<PaymentHistoryResponse> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<PaymentHistoryResponse>(`/reports/payments?${query}`, { signal })
}

// ─── Export ────────────────────────────────────────────────────────────────────

/**
 * Trigger a server-side export for any report type.
 *
 * The server generates the file (PDF / XLSX / CSV) and returns a time-limited
 * download URL. The client opens this URL directly or uses it for download.
 *
 * Note: PDF exports are capped at MAX_PDF_EXPORT_ROWS rows — the server will
 * reject requests exceeding this limit with 400 EXPORT_LIMIT_EXCEEDED.
 */
export async function exportReport(
  request: ExportRequest,
  signal?: AbortSignal
): Promise<ExportResponse> {
  return api<ExportResponse>('/reports/export', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  })
}
