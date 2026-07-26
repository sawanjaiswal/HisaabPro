/**
 * Return-side GST helpers (plan §12b).
 *
 * These read what the DEPARTMENT would see: the aggregates a return is filed
 * from, not the document the seller printed. Every call goes over the API with
 * the logged-in page's own session, so the tenant scoping is exercised too.
 */

import type { Page } from '@playwright/test'
import { csrfRequest } from './fixtures'
import { API } from './parties'

/** `YYYY-MM` for a `YYYY-MM-DD` date — the period a document falls in. */
export function periodOf(date: string): string {
  return date.slice(0, 7)
}

async function getJson<T>(page: Page, url: string): Promise<T> {
  const res = await page.request.get(url)
  if (!res.ok()) throw new Error(`GET ${url} failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as { data?: T }
  if (body.data === undefined) throw new Error(`GET ${url} returned no data`)
  return body.data
}

export interface TaxHeads {
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  total: number
  count: number
}

export interface TaxSummary {
  period: { from: string; to: string }
  sales: TaxHeads
  purchases: TaxHeads
  creditNotes: TaxHeads
  debitNotes: TaxHeads
  netTaxLiability: { cgst: number; sgst: number; igst: number; cess: number }
}

export async function apiTaxSummary(page: Page, from: string, to: string): Promise<TaxSummary> {
  return getJson<TaxSummary>(page, `${API}/reports/tax-summary?from=${from}&to=${to}`)
}

export interface HsnRow {
  hsnCode: string | null
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
  [key: string]: unknown
}

export async function apiHsnSummary(page: Page, from: string, to: string): Promise<HsnRow[]> {
  const data = await getJson<{ items?: HsnRow[] } | HsnRow[]>(
    page,
    `${API}/reports/hsn-summary?from=${from}&to=${to}`,
  )
  return Array.isArray(data) ? data : (data.items ?? [])
}

/** Sum of every tax head on a report row, whatever the split. */
export function headsOf(r: {
  cgst?: number
  sgst?: number
  igst?: number
  cess?: number
}): number {
  return Number(r.cgst ?? 0) + Number(r.sgst ?? 0) + Number(r.igst ?? 0) + Number(r.cess ?? 0)
}

export interface Gstr1Entry {
  ctin?: string
  inv?: Array<{ inum: string; val: number; itms?: unknown[] }>
  [key: string]: unknown
}

export interface Gstr1Export {
  jsonData: {
    gstin: string
    fp: string
    b2b: Gstr1Entry[]
    b2cs: Array<Record<string, unknown>>
    cdnr: Gstr1Entry[]
    hsn: { data: Array<Record<string, unknown>> }
    [key: string]: unknown
  }
  csvData: string
  summary: Record<string, number | string>
}

/** Regenerates GSTR-1 for the period and returns the NIC envelope. */
export async function apiExportGstr1(page: Page, period: string): Promise<Gstr1Export> {
  const res = await csrfRequest(page, 'post', `${API}/gst/returns/GSTR1/${period}/export`)
  if (!res.ok()) throw new Error(`GSTR1 export failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as { data?: Gstr1Export }
  if (!body.data) throw new Error('GSTR1 export returned no data')
  return body.data
}

export interface Gstr3bSection {
  section: string
  taxableValue: number
  cgst: number
  sgst: number
  igst: number
  cess: number
}

export interface Gstr3bExport {
  summary: {
    period: string
    sections: Gstr3bSection[]
    netPayable: { cgst: number; sgst: number; igst: number; cess: number }
  }
  csvData: string
}

export async function apiExportGstr3b(page: Page, period: string): Promise<Gstr3bExport> {
  const res = await csrfRequest(page, 'post', `${API}/gst/returns/GSTR3B/${period}/export`)
  if (!res.ok()) throw new Error(`GSTR3B export failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as { data?: Gstr3bExport }
  if (!body.data) throw new Error('GSTR3B export returned no data')
  return body.data
}

/** The stored return summary — a read, never a recompute. */
export async function apiGetReturn<T>(page: Page, type: string, period: string): Promise<T> {
  return getJson<T>(page, `${API}/gst/returns/${type}/${period}`)
}

export interface FilingReadiness {
  period: string
  returnType: string
  documentsScanned: number
  checks: Array<{ id: string; severity: 'blocker' | 'warning'; count: number }>
  blockerCount: number
  warningCount: number
  readyToFile: boolean
}

export async function apiFilingReadiness(
  page: Page,
  period: string,
  returnType = 'GSTR1',
): Promise<FilingReadiness> {
  return getJson<FilingReadiness>(
    page,
    `${API}/gst/filing-readiness?period=${period}&returnType=${returnType}`,
  )
}
