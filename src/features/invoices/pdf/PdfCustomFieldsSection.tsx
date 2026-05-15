/**
 * PR4 — "Custom Details" block for the invoice PDF.
 *
 * Renders after the line-items table, before the totals block.
 * Uses @react-pdf/renderer <Text> exclusively — auto-escaped, no XSS risk.
 *
 * Security (4.1 FIXED):
 *  - Component only receives pre-filtered rows (showOnInvoice=true).
 *  - filterPdfCustomFieldRows() enforces both showOnInvoice AND documentType
 *    filters before rows reach this component.
 *  - businessId scoping is enforced by the API layer (defence-in-depth).
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { PdfCustomFieldsSectionProps } from './pdf-custom-fields.types'

// ─── Styles ──────────────────────────────────────────────────────────────────
// Reuse the same token values as PartyLedgerPDF and StatementPDFTemplate.

const s = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    width: '35%',
    fontSize: 8,
    color: '#6B7280',
    fontFamily: 'Helvetica',
  },
  value: {
    width: '65%',
    fontSize: 8,
    color: '#111827',
    fontFamily: 'Helvetica',
  },
})

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders a "Custom Details" block inside a React-PDF Document.
 *
 * Caller is responsible for filtering rows before passing them here.
 * When rows is empty the component renders nothing (null equivalent).
 */
export function PdfCustomFieldsSection({ rows, sectionLabel }: PdfCustomFieldsSectionProps) {
  if (rows.length === 0) return null

  return (
    <View style={s.wrapper}>
      <Text style={s.sectionLabel}>{sectionLabel}</Text>
      {rows.map((row) => (
        <View key={row.fieldDefId} style={s.row}>
          <Text style={s.label}>{row.name}</Text>
          <Text style={s.value}>{row.displayValue}</Text>
        </View>
      ))}
    </View>
  )
}
