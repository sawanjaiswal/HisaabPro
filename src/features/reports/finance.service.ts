/** Financial Reports — API service layer */

import { api } from '@/lib/api'
import type {
  ProfitLossData,
  BalanceSheetData,
  CashFlowData,
  AgingReportData,
  AgingType,
  ProfitabilityData,
  ProfitabilityGroupBy,
  DiscountReportData,
  FYClosure,
  FYClosureResult,
} from './finance.types'

export async function getProfitLoss(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<ProfitLossData> {
  const params = new URLSearchParams({ from, to })
  return api<ProfitLossData>(`/reports/financial/profit-loss?${params}`, { signal })
}

export async function getBalanceSheet(
  asOf: string,
  signal?: AbortSignal
): Promise<BalanceSheetData> {
  const params = new URLSearchParams({ asOf })
  return api<BalanceSheetData>(`/reports/financial/balance-sheet?${params}`, { signal })
}

export async function getCashFlow(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<CashFlowData> {
  const params = new URLSearchParams({ from, to })
  return api<CashFlowData>(`/reports/financial/cash-flow?${params}`, { signal })
}

export async function getAgingReport(
  type: AgingType,
  signal?: AbortSignal
): Promise<AgingReportData> {
  const params = new URLSearchParams({ type })
  return api<AgingReportData>(`/reports/financial/aging?${params}`, { signal })
}

export async function getProfitability(
  from: string,
  to: string,
  groupBy: ProfitabilityGroupBy,
  signal?: AbortSignal
): Promise<ProfitabilityData> {
  const params = new URLSearchParams({ from, to, groupBy })
  return api<ProfitabilityData>(`/reports/financial/profitability?${params}`, { signal })
}

export async function getDiscountReport(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<DiscountReportData> {
  const params = new URLSearchParams({ from, to })
  return api<DiscountReportData>(`/reports/financial/discounts?${params}`, { signal })
}

export async function exportTally(from: string, to: string): Promise<string> {
  const params = new URLSearchParams({ from, to })
  const response = await fetch(`/api/reports/financial/tally-export?${params}`, { credentials: 'include' })
  if (!response.ok) throw new Error('Export failed')
  return response.text()
}

// ─── FY Closure ──────────────────────────────────────────────────────────────

export async function getFYClosures(signal?: AbortSignal): Promise<FYClosure[]> {
  return api<FYClosure[]>('/fy-closure', { signal })
}

export async function closeFY(financialYear: string): Promise<FYClosureResult> {
  return api<FYClosureResult>('/fy-closure', {
    method: 'POST',
    body: JSON.stringify({ financialYear }),
  })
}

export async function reopenFY(financialYear: string): Promise<FYClosure> {
  return api<FYClosure>(`/fy-closure/${financialYear}/reopen`, { method: 'POST' })
}
