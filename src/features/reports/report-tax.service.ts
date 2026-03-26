/** Reports — Tax-related API services (Tax Summary, HSN, Tax Ledger, GST Returns, TDS/TCS) */

import { api } from '@/lib/api'
import { buildQueryString } from './report.utils'
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

// ─── Tax Summary ───────────────────────────────────────────────────────────────

export async function getTaxSummary(
  filters: TaxSummaryFilters,
  signal?: AbortSignal
): Promise<TaxSummaryData> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<TaxSummaryData>(`/reports/tax-summary?${query}`, { signal })
}

export async function getHsnSummary(
  filters: TaxSummaryFilters,
  signal?: AbortSignal
): Promise<HsnSummaryData> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<HsnSummaryData>(`/reports/hsn-summary?${query}`, { signal })
}

export async function getTaxLedger(
  filters: TaxLedgerFilters,
  signal?: AbortSignal
): Promise<TaxLedgerData> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<TaxLedgerData>(`/reports/tax-ledger?${query}`, { signal })
}

// ─── GST Returns ───────────────────────────────────────────────────────────────

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

export async function getTdsTcsSummary(
  filters: TdsTcsFilters,
  signal?: AbortSignal
): Promise<TdsTcsSummaryData> {
  const query = buildQueryString(filters as unknown as Record<string, unknown>)
  return api<TdsTcsSummaryData>(`/reports/tds-tcs-summary?${query}`, { signal })
}
