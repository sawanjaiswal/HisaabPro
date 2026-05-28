/**
 * Pure GST filing-readiness rules (#144). Each rule takes the normalized
 * documents + business context and returns the list of offending docs.
 * No I/O — fully unit-testable. The service wraps these into GstCheck rows.
 */

import type {
  CheckContext,
  CheckDoc,
  GstCheckDocRef,
  GstCheckId,
  GstCheckSeverity,
} from './gst-validation.types.js'

/** Standard 15-char GSTIN: 2-digit state + 10-char PAN + entity + 'Z' + checksum. */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export function isValidGstin(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin)
}

const ref = (d: CheckDoc): GstCheckDocRef => ({ id: d.id, documentNumber: d.documentNumber })

export interface RuleDef {
  id: GstCheckId
  severity: GstCheckSeverity
  /** Returns true when the doc VIOLATES the rule. */
  predicate: (doc: CheckDoc, ctx: CheckContext) => boolean
}

/** A document is interstate when the recipient's place of supply differs from the seller's state. */
export function isInterState(placeOfSupply: string | null, businessStateCode: string | null): boolean {
  if (!placeOfSupply || !businessStateCode) return false
  return placeOfSupply !== businessStateCode
}

const hasTaxableLine = (doc: CheckDoc) => doc.lines.some((l) => l.taxableValue > 0)

export const GST_RULES: RuleDef[] = [
  {
    id: 'B2B_MISSING_GSTIN',
    severity: 'blocker',
    predicate: (doc) => doc.supplyType === 'B2B' && !doc.partyGstin,
  },
  {
    id: 'INVALID_GSTIN_FORMAT',
    severity: 'blocker',
    predicate: (doc) => !!doc.partyGstin && !isValidGstin(doc.partyGstin),
  },
  {
    id: 'MISSING_PLACE_OF_SUPPLY',
    severity: 'blocker',
    predicate: (doc) => hasTaxableLine(doc) && !doc.placeOfSupply,
  },
  {
    id: 'MISSING_HSN_SAC',
    severity: 'warning',
    predicate: (doc) => doc.lines.some((l) => l.taxableValue > 0 && !l.hsnCode && !l.sacCode),
  },
  {
    id: 'INTERSTATE_SPLIT_MISMATCH',
    severity: 'blocker',
    predicate: (doc, ctx) => {
      // Can only judge the split when we know both states and there's a place of supply.
      if (!doc.placeOfSupply || !ctx.businessStateCode) return false
      const inter = isInterState(doc.placeOfSupply, ctx.businessStateCode)
      if (inter) {
        // Interstate must be IGST only — any CGST/SGST is wrong.
        return doc.lines.some((l) => l.taxableValue > 0 && (l.cgstRate > 0 || l.sgstRate > 0))
      }
      // Intrastate must be CGST+SGST — any IGST is wrong.
      return doc.lines.some((l) => l.taxableValue > 0 && l.igstRate > 0)
    },
  },
  {
    id: 'COMPOSITION_CHARGING_GST',
    severity: 'blocker',
    predicate: (doc, ctx) =>
      ctx.businessComposition && doc.totalCgst + doc.totalSgst + doc.totalIgst > 0,
  },
  {
    id: 'ZERO_TAX_ON_TAXABLE',
    severity: 'warning',
    predicate: (doc, ctx) => {
      // Composition dealers legitimately charge no GST — skip the rule for them.
      if (ctx.businessComposition) return false
      return doc.lines.some(
        (l) => l.taxableValue > 0 && l.cgstRate === 0 && l.sgstRate === 0 && l.igstRate === 0,
      )
    },
  },
]

/** Caps offending-doc lists so the readiness payload stays small on huge periods. */
export const GST_CHECK_DOC_CAP = 50

export interface RuleResult {
  id: GstCheckId
  severity: GstCheckSeverity
  count: number
  documents: GstCheckDocRef[]
}

/** Runs every rule over the docs and returns only the rules that fired (count > 0). */
export function runGstRules(docs: CheckDoc[], ctx: CheckContext): RuleResult[] {
  const results: RuleResult[] = []
  for (const rule of GST_RULES) {
    const offenders: GstCheckDocRef[] = []
    let count = 0
    for (const doc of docs) {
      if (rule.predicate(doc, ctx)) {
        count++
        if (offenders.length < GST_CHECK_DOC_CAP) offenders.push(ref(doc))
      }
    }
    if (count > 0) {
      results.push({ id: rule.id, severity: rule.severity, count, documents: offenders })
    }
  }
  return results
}
