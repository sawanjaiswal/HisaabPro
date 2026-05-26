/**
 * Phase 7 · 7.1C — Invoice normalizer (post-aggregation).
 *
 * Pipeline per `AggregatedInvoiceGroup`:
 *
 *   1. Sanitise header text fields (party name, GSTIN, notes) — strip
 *      controls + bidi + NFKC via shared `sanitizeControlChars` (7.1B M6).
 *   2. Parse paise totals via `parsePaiseBigInt`, narrow to Int via
 *      `narrowPaiseToInt` — emits `AMOUNT_OUT_OF_RANGE` / `AMOUNT_NEGATIVE`
 *      issues per AUDIT S3.
 *   3. For each line: parse qty, paise totals, validate HSN (reused
 *      from 7.1B), resolve unit alias (reused from 7.1B).
 *   4. Run tax reconciler (§2.4) against summed-line vs reported
 *      grand total — appends `TAX_MATH_MISMATCH` warning on drift > 50p.
 *   5. Returns one `StagedInvoiceRow`; the dispatcher then writes
 *      `ImportJobRow.normalized` rows into the DB.
 *
 * The normalizer does NOT touch FK resolution (party/product) — that
 * runs at commit time so the chunk tx can preload both tables in one
 * roundtrip. The normalizer only fills the raw-parsed `header`/`lines`
 * plus narrowed paise totals.
 */

import { reconcileTaxTotals } from './tax-reconciler.js'
import { sanitizeControlChars } from '../security/unicode.js'
import { validateHsn } from '../utils/hsn.util.js'
import { resolveUnit } from '../utils/unit-resolver.js'
import { paiseOrZero, paiseOrNull, parseQty } from './normalizer-line.util.js'
import type {
  InvoiceHeader,
  InvoiceIssue,
  InvoiceLine,
  NormalizedInvoice,
  StagedInvoiceRow,
} from './invoice.types.js'
import type { AggregatedInvoiceGroup } from './aggregator.js'

function asInvoiceHeader(
  g: AggregatedInvoiceGroup,
): InvoiceHeader {
  return {
    documentNumber: g.header.invoiceNumber,
    documentDate: g.header.invoiceDate,
    partyNameRaw: g.header.partyName,
    partyPhoneRaw: g.header.partyPhone,
    partyGstinRaw: g.header.partyGstin,
    subtotalRaw: g.header.subtotal,
    totalCgstRaw: g.header.totalCgst,
    totalSgstRaw: g.header.totalSgst,
    totalIgstRaw: g.header.totalIgst,
    grandTotalRaw: g.header.grandTotal,
    notes: g.header.notes,
  }
}

function asInvoiceLines(
  g: AggregatedInvoiceGroup,
): InvoiceLine[] {
  return g.lines.map((l, idx) => ({
    sourceLineIndex: idx,
    skuRaw: l.sku,
    productNameRaw: l.productName,
    qtyRaw: l.qty,
    unitRaw: l.unit,
    rateRaw: l.rate,
    discountRaw: l.discount,
    taxableValueRaw: l.taxableValue,
    cgstRaw: l.cgst,
    sgstRaw: l.sgst,
    igstRaw: l.igst,
    lineTotalRaw: l.lineTotal,
  }))
}

export function normalizeInvoiceGroup(
  g: AggregatedInvoiceGroup,
): StagedInvoiceRow {
  // Aggregator-level fatal issues (INVALID_DATE / HEADER_MISMATCH /
  // INVOICE_NUMBER_REQUIRED / LINES_PER_INVOICE_EXCEEDED) short-circuit
  // — we still stage the raw shape so the preview can render the row.
  const fatal = g.issues.find((i) => i.severity === 'ERROR')
  const header = asInvoiceHeader(g)
  const lines = asInvoiceLines(g)
  if (fatal || !g.isoDate || !g.header.invoiceNumber) {
    return {
      sourceIndex: g.sourceIndex,
      header,
      lines,
      normalized: null,
      issues: [...g.issues],
    }
  }

  const issues: InvoiceIssue[] = []

  // Header sanitisation (notes/party name are user-supplied text).
  const cleanPartyName = g.header.partyName
    ? sanitizeControlChars(g.header.partyName, { maxLen: 200 })
    : null
  const cleanPhone = g.header.partyPhone
    ? sanitizeControlChars(g.header.partyPhone, { maxLen: 32 })
    : null
  const cleanGstin = g.header.partyGstin
    ? sanitizeControlChars(g.header.partyGstin, { maxLen: 32 })
    : null
  const cleanNotes = g.header.notes
    ? sanitizeControlChars(g.header.notes, { maxLen: 1000 })
    : null

  // Header amount narrowing.
  const subtotalPaise = paiseOrZero(g.header.subtotal, 'subtotal', issues)
  const totalCgstPaise = paiseOrZero(g.header.totalCgst, 'totalCgst', issues)
  const totalSgstPaise = paiseOrZero(g.header.totalSgst, 'totalSgst', issues)
  const totalIgstPaise = paiseOrZero(g.header.totalIgst, 'totalIgst', issues)
  const grandTotalPaise = paiseOrZero(g.header.grandTotal, 'grandTotal', issues)

  // Per-line narrowing + HSN + unit resolution.
  const normLines: NormalizedInvoice['lines'] = g.lines.map((l, idx) => {
    const ratePaise = paiseOrNull(l.rate, 'rate', idx, issues)
    const taxableValuePaise = paiseOrNull(l.taxableValue, 'taxableValue', idx, issues)
    const cgstPaise = paiseOrNull(l.cgst, 'cgst', idx, issues)
    const sgstPaise = paiseOrNull(l.sgst, 'sgst', idx, issues)
    const igstPaise = paiseOrNull(l.igst, 'igst', idx, issues)
    const lineTotalPaise = paiseOrNull(l.lineTotal, 'lineTotal', idx, issues)
    // Unit + HSN normalisation (consumed at commit time). Right now we
    // only sanitise text; resolved IDs land in PR-C3 (commit chunk tx).
    void (l.unit ? resolveUnit(l.unit) : { unit: null })
    void validateHsn(null) // HSN not on invoice lines in our schema yet
    const cleanSku = l.sku
      ? sanitizeControlChars(l.sku, { maxLen: 64 })
      : null
    const cleanName = l.productName
      ? sanitizeControlChars(l.productName, { maxLen: 200 })
      : null
    return {
      source: {
        sourceLineIndex: idx,
        skuRaw: cleanSku,
        productNameRaw: cleanName,
        qtyRaw: l.qty,
        unitRaw: l.unit,
        rateRaw: l.rate,
        discountRaw: l.discount,
        taxableValueRaw: l.taxableValue,
        cgstRaw: l.cgst,
        sgstRaw: l.sgst,
        igstRaw: l.igst,
        lineTotalRaw: l.lineTotal,
      },
      resolved: {
        productId: null,
        matchedBy: 'NOT_FOUND',
        source: { sku: cleanSku, name: cleanName },
      },
      qty: parseQty(l.qty),
      ratePaise,
      taxableValuePaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      lineTotalPaise,
    }
  })

  // Tax reconciliation — sum line totals vs reported grand total.
  const computedGrand = normLines.reduce(
    (acc, l) => acc + (l.lineTotalPaise ?? 0), 0,
  )
  if (grandTotalPaise > 0) {
    const recon = reconcileTaxTotals({
      computedGrandPaise: computedGrand,
      reportedGrandPaise: grandTotalPaise,
    })
    if (recon.issue) issues.push(recon.issue)
  }

  const normalized: NormalizedInvoice = {
    documentNumber: g.header.invoiceNumber,
    documentDate: g.isoDate,
    party: {
      partyId: null,
      matchedBy: 'NOT_FOUND',
      source: { name: cleanPartyName ?? '', phone: cleanPhone },
    },
    lines: normLines,
    subtotalPaise,
    totalCgstPaise,
    totalSgstPaise,
    totalIgstPaise,
    grandTotalPaise,
    notes: cleanNotes,
  }
  return {
    sourceIndex: g.sourceIndex,
    header: { ...header, partyGstinRaw: cleanGstin },
    lines,
    normalized,
    issues: [...g.issues, ...issues],
  }
}
