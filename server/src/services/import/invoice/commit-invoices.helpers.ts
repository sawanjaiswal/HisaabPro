/**
 * Phase 7 · 7.1C PR-C3 — commit-invoices helpers (types + collectors).
 *
 * Extracted from commit-invoices.service.ts to keep that file under the
 * 250L cap. These are pure functions; tested transitively via the
 * commit-invoices unit tests.
 */

import type { PartyCandidateInput } from './party-resolver.js'
import type { ProductCandidateInput } from './product-resolver.js'

export interface NormalizedInvoiceWire {
  documentNumber: string | null
  documentDate: string
  party: { source: { name: string; phone: string | null } }
  lines: Array<{
    source: { sku: string | null; productNameRaw?: string | null }
    resolved: { productId: string | null; matchedBy: string }
    qty: number
    ratePaise: number | null
    taxableValuePaise: number | null
    cgstPaise: number | null
    sgstPaise: number | null
    igstPaise: number | null
    lineTotalPaise: number | null
  }>
  subtotalPaise: number
  totalCgstPaise: number
  totalSgstPaise: number
  totalIgstPaise: number
  grandTotalPaise: number
  notes: string | null
  partyResolutionMode?: 'MATCH_OR_FLY_CREATE' | 'REQUIRE_PARTIES_FIRST'
}

export interface StagedInvoiceRowMin {
  id: string
  sourceIndex: number
  normalized: NormalizedInvoiceWire | null
}

export function isPrismaP2003(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2003'
  )
}

export function collectMissingSkuSample(
  rows: StagedInvoiceRowMin[],
  cap: number,
): string[] {
  const out: string[] = []
  for (const row of rows) {
    for (const line of row.normalized?.lines ?? []) {
      if (line.resolved.matchedBy === 'NOT_FOUND') {
        const sample = line.source.sku ?? line.source.productNameRaw ?? '(unknown)'
        out.push(sample)
        if (out.length >= cap) return out
      }
    }
  }
  return out
}

export function countBlockedRows(rows: StagedInvoiceRowMin[]): number {
  let n = 0
  for (const row of rows) {
    const lines = row.normalized?.lines ?? []
    if (lines.some((l) => l.resolved.matchedBy === 'NOT_FOUND')) n += 1
  }
  return n
}

export function collectPartyCandidates(
  rows: StagedInvoiceRowMin[],
): PartyCandidateInput[] {
  const out: PartyCandidateInput[] = []
  for (const row of rows) {
    if (row.normalized) {
      out.push({
        name: row.normalized.party.source.name,
        phone: row.normalized.party.source.phone,
      })
    }
  }
  return out
}

export function collectProductCandidates(
  rows: StagedInvoiceRowMin[],
): ProductCandidateInput[] {
  const out: ProductCandidateInput[] = []
  for (const row of rows) {
    for (const line of row.normalized?.lines ?? []) {
      out.push({
        sku: line.source.sku ?? null,
        name: line.source.productNameRaw ?? null,
      })
    }
  }
  return out
}
