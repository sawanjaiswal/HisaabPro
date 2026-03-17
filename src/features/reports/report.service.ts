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
} from './report.types'
import type {
  TaxSummaryFilters,
  TaxSummaryData,
  HsnSummaryData,
  TaxLedgerFilters,
  TaxLedgerData,
  GstReturnType,
  Gstr1Data,
  Gstr3bData,
  Gstr9Data,
  GstExportData,
  TdsTcsFilters,
  TdsTcsSummaryData,
} from './report-tax.types'

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

// ─── Tax Summary ───────────────────────────────────────────────────────────────

/**
 * Fetch tax summary (sales, purchases, credit notes, debit notes) for a date range.
 * Returns pre-aggregated tax breakdowns and net tax liability in paise.
 */
export async function getTaxSummary(
  filters: TaxSummaryFilters,
  signal?: AbortSignal
): Promise<TaxSummaryData> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<TaxSummaryData>(`/reports/tax-summary?${query}`, { signal })
}

/**
 * Fetch HSN-wise tax summary for a date range.
 * Each item contains quantity, taxable value, and component-wise tax totals.
 */
export async function getHsnSummary(
  filters: TaxSummaryFilters,
  signal?: AbortSignal
): Promise<HsnSummaryData> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<HsnSummaryData>(`/reports/hsn-summary?${query}`, { signal })
}

/**
 * Fetch paginated tax ledger entries for a date range.
 * Uses cursor-based pagination — pass cursor from previous response for next page.
 */
export async function getTaxLedger(
  filters: TaxLedgerFilters,
  signal?: AbortSignal
): Promise<TaxLedgerData> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<TaxLedgerData>(`/reports/tax-ledger?${query}`, { signal })
}

// ─── GST Returns ───────────────────────────────────────────────────────────────

/**
 * Fetch a specific GST return (GSTR-1, GSTR-3B, or GSTR-9) for a given period.
 * Period format: "YYYY-MM" (e.g. "2026-03").
 */
export async function getGstReturn(
  returnType: GstReturnType,
  period: string,
  signal?: AbortSignal
): Promise<Gstr1Data | Gstr3bData | Gstr9Data> {
  return api<Gstr1Data | Gstr3bData | Gstr9Data>(
    `/gst/returns/${returnType}/${period}`,
    { signal }
  )
}

/**
 * Export a GST return as JSON.
 * Currently only GSTR-1 supports JSON export.
 * Returns the export data and a suggested file name.
 */
export async function exportGstReturn(
  returnType: GstReturnType,
  period: string,
  format: 'JSON',
  signal?: AbortSignal
): Promise<GstExportData> {
  return api<GstExportData>(
    `/gst/returns/${returnType}/${period}/export`,
    {
      method: 'POST',
      body: JSON.stringify({ format }),
      signal,
    }
  )
}

// ─── TDS / TCS Summary ─────────────────────────────────────────────────────────

/**
 * Fetch TDS/TCS summary for a date range.
 *
 * `type` controls which entries are returned:
 *   - 'tds'  → only entries with tdsAmount > 0
 *   - 'tcs'  → only entries with tcsAmount > 0
 *   - 'all'  → all entries (default)
 *
 * `partyId` is optional — omit to get all parties.
 * All amounts in paise, rates in basis points.
 */
export async function getTdsTcsSummary(
  filters: TdsTcsFilters,
  signal?: AbortSignal
): Promise<TdsTcsSummaryData> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<TdsTcsSummaryData>(`/reports/tds-tcs-summary?${query}`, { signal })
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
/**
 * Export a report as CSV download.
 * Triggers a file download in the browser.
 * PDF export is planned for Phase 2.
 */
export async function exportReport(
  request: ExportRequest,
  signal?: AbortSignal
): Promise<void> {
  const { API_URL } = await import('@/config/app.config')

  const response = await fetch(`${API_URL}/reports/export`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`)
  }

  // CSV: trigger browser download
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="(.+)"/)
  const fileName = match?.[1] || `${request.reportType}-export.csv`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
