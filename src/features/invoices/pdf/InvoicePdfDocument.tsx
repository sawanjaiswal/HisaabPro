/**
 * InvoicePdfDocument — React-PDF Document for all invoice/sales document types.
 *
 * Structure (A4, portrait):
 *   Business header | Party + doc meta | Line items table
 *   ─── Custom Details (showOnInvoice fields, PR4) ───────────
 *   Totals | Notes | Signature
 *
 * Uses @react-pdf/renderer <Text>/<View> exclusively. No dangerouslySetInnerHTML.
 * Intl unavailable in the react-pdf renderer — all formatting is manual.
 *
 * Security (4.1 FIXED): PdfCustomFieldsSection only receives rows pre-filtered
 * by filterPdfCustomFieldRows (showOnInvoice=true + docType + businessId scoped
 * by API layer). See pdf-custom-fields.types.ts for the filter logic.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { DocumentDetail } from '../invoice-document.types'
import { PdfCustomFieldsSection } from './PdfCustomFieldsSection'
import type { PdfCustomFieldRow } from './pdf-custom-fields.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPaise(paise: number): string {
  const abs = Math.abs(paise)
  const [intPart, decPart] = (abs / 100).toFixed(2).split('.')
  const n = intPart ?? '0'
  if (n.length <= 3) {
    return `${paise < 0 ? '-' : ''}Rs ${n}.${decPart}`
  }
  const suffix = n.slice(n.length - 3)
  const prefix = n.slice(0, n.length - 3)
  let g = ''
  let i2 = 0
  for (let i = prefix.length - 1; i >= 0; i--) {
    g = prefix[i] + g
    i2++
    if (i2 % 2 === 0 && i !== 0) g = ',' + g
  }
  return `${paise < 0 ? '-' : ''}Rs ${g},${suffix}.${decPart}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d ?? '--'}/${m ?? '--'}/${y ?? '----'}`
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#111827', backgroundColor: '#FFFFFF' },
  heading:     { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  subheading:  { fontSize: 8, color: '#6B7280', marginBottom: 1 },
  row2col:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  divider:     { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 6 },
  label:       { fontSize: 7, color: '#9CA3AF', marginBottom: 1 },
  value:       { fontSize: 9, color: '#111827' },
  bold:        { fontFamily: 'Helvetica-Bold' },
  // line items table
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 4, paddingHorizontal: 2 },
  tableRow:    { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  colNo:       { width: '6%' },
  colItem:     { width: '40%' },
  colQty:      { width: '12%', textAlign: 'right' },
  colRate:     { width: '18%', textAlign: 'right' },
  colTotal:    { width: '24%', textAlign: 'right' },
  // totals
  totalsBlock: { marginTop: 6, alignSelf: 'flex-end', width: '55%' },
  totalsRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grandTotal:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderTopWidth: 1, borderTopColor: '#111827', marginTop: 2 },
  footer:      { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7, color: '#9CA3AF', textAlign: 'center' },
  notesBox:    { marginTop: 6, fontSize: 8, color: '#4B5563' },
})

// ─── Sub-components ──────────────────────────────────────────────────────────

function LineItemsTable({ items }: { items: DocumentDetail['lineItems'] }) {
  return (
    <View>
      <View style={s.tableHeader}>
        <Text style={s.colNo}>#</Text>
        <Text style={[s.colItem, s.bold]}>Item</Text>
        <Text style={[s.colQty, s.bold]}>Qty</Text>
        <Text style={[s.colRate, s.bold]}>Rate</Text>
        <Text style={[s.colTotal, s.bold]}>Amount</Text>
      </View>
      {items.map((item, idx) => (
        <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {}]}>
          <Text style={s.colNo}>{idx + 1}</Text>
          <Text style={s.colItem}>{item.product.name}</Text>
          <Text style={s.colQty}>{item.quantity} {item.product.unit}</Text>
          <Text style={s.colRate}>{fmtPaise(item.rate)}</Text>
          <Text style={s.colTotal}>{fmtPaise(item.lineTotal)}</Text>
        </View>
      ))}
    </View>
  )
}

function TotalsBlock({ doc }: { doc: DocumentDetail }) {
  return (
    <View style={s.totalsBlock}>
      <View style={s.totalsRow}>
        <Text style={{ color: '#6B7280' }}>Subtotal</Text>
        <Text>{fmtPaise(doc.subtotal)}</Text>
      </View>
      {doc.totalDiscount > 0 && (
        <View style={s.totalsRow}>
          <Text style={{ color: '#6B7280' }}>Discount</Text>
          <Text>- {fmtPaise(doc.totalDiscount)}</Text>
        </View>
      )}
      {doc.additionalCharges.map((c) => (
        <View key={c.id} style={s.totalsRow}>
          <Text style={{ color: '#6B7280' }}>{c.name}</Text>
          <Text>{fmtPaise(c.amount)}</Text>
        </View>
      ))}
      {doc.roundOff !== 0 && (
        <View style={s.totalsRow}>
          <Text style={{ color: '#6B7280' }}>Round Off</Text>
          <Text>{doc.roundOff > 0 ? '+' : ''}{fmtPaise(doc.roundOff)}</Text>
        </View>
      )}
      <View style={s.grandTotal}>
        <Text style={s.bold}>Total</Text>
        <Text style={s.bold}>{fmtPaise(doc.grandTotal)}</Text>
      </View>
      {doc.paidAmount > 0 && (
        <View style={s.totalsRow}>
          <Text style={{ color: '#6B7280' }}>Paid</Text>
          <Text>- {fmtPaise(doc.paidAmount)}</Text>
        </View>
      )}
      {doc.balanceDue > 0 && (
        <View style={[s.grandTotal, { borderTopColor: '#E5E7EB' }]}>
          <Text style={{ ...s.bold, color: '#DC2626' }}>Balance Due</Text>
          <Text style={{ ...s.bold, color: '#DC2626' }}>{fmtPaise(doc.balanceDue)}</Text>
        </View>
      )}
    </View>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface InvoicePdfDocumentProps {
  doc: DocumentDetail
  businessName: string
  businessAddress?: string
  businessGstin?: string
  /** Pre-filtered custom field rows (showOnInvoice=true, correct docType).
   *  Produced by filterPdfCustomFieldRows() — security 4.1 enforced there. */
  customFieldRows: PdfCustomFieldRow[]
  /** Localised section label: "Custom Details" / "अन्य विवरण" */
  customDetailsSectionLabel: string
}

export function InvoicePdfDocument({
  doc,
  businessName,
  businessAddress,
  businessGstin,
  customFieldRows,
  customDetailsSectionLabel,
}: InvoicePdfDocumentProps) {
  return (
    <Document
      title={`${doc.type} — ${doc.documentNumber}`}
      author={businessName}
    >
      <Page size="A4" style={s.page}>

        {/* Business header */}
        <Text style={s.heading}>{businessName}</Text>
        {businessAddress && <Text style={s.subheading}>{businessAddress}</Text>}
        {businessGstin   && <Text style={s.subheading}>GSTIN: {businessGstin}</Text>}
        <View style={s.divider} />

        {/* Document meta + Party */}
        <View style={s.row2col}>
          <View>
            <Text style={s.label}>Billed To</Text>
            <Text style={[s.value, s.bold]}>{doc.party.name}</Text>
            {doc.party.phone && <Text style={s.subheading}>{doc.party.phone}</Text>}
            {doc.party.gstin && <Text style={s.subheading}>GSTIN: {doc.party.gstin}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.value, s.bold]}>{doc.documentNumber}</Text>
            <Text style={s.subheading}>{fmtDate(doc.documentDate)}</Text>
            {doc.dueDate && <Text style={s.subheading}>Due: {fmtDate(doc.dueDate)}</Text>}
            <Text style={[s.subheading, { marginTop: 2, textTransform: 'capitalize' }]}>
              {doc.status.toLowerCase()}
            </Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* Line items */}
        <LineItemsTable items={doc.lineItems} />

        {/* ── PR4 Custom Details block (after line-items, before totals) ───── */}
        {/* Security 4.1 FIXED: only showOnInvoice=true rows reach here */}
        <PdfCustomFieldsSection
          rows={customFieldRows}
          sectionLabel={customDetailsSectionLabel}
        />
        {/* ────────────────────────────────────────────────────────────────── */}

        {/* Totals */}
        <TotalsBlock doc={doc} />

        {/* Notes */}
        {doc.notes && (
          <View style={s.notesBox}>
            <Text style={[s.label, { marginTop: 8 }]}>Notes</Text>
            <Text>{doc.notes}</Text>
          </View>
        )}
        {doc.termsAndConditions && (
          <View style={s.notesBox}>
            <Text style={[s.label, { marginTop: 6 }]}>Terms & Conditions</Text>
            <Text>{doc.termsAndConditions}</Text>
          </View>
        )}

        <Text style={s.footer} render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}  |  Generated by HisaabPro`
        } />

      </Page>
    </Document>
  )
}
