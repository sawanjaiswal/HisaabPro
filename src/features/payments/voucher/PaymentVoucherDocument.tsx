/** PaymentVoucherDocument — React-PDF voucher for payments (#90 receipt, #91 payment).
 *
 * A4 portrait. Uses @react-pdf/renderer <Text>/<View> only — Intl is unavailable
 * in the renderer worker, so all formatting comes from voucher.utils.
 *
 * Mirrors the structure proven in invoices/pdf/InvoicePdfDocument: business
 * header, party + meta two-column, amount block, allocations table, footer.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { fmtPaise, fmtDate } from './voucher.utils'
import type { VoucherData } from './voucher.types'

/** Static labels baked into the PDF (the renderer can't read React context). */
export interface VoucherDocLabels {
  receivedFrom: string
  paidTo: string
  amount: string
  inWords: string
  paymentMode: string
  reference: string
  date: string
  appliedTo: string
  unallocated: string
  notes: string
  generatedBy: string
}

const s = StyleSheet.create({
  page:        { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#111827', backgroundColor: '#FFFFFF' },
  businessName:{ fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  voucherTitle:{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0F766E', textTransform: 'uppercase', letterSpacing: 1 },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  divider:     { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 8 },
  row2col:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label:       { fontSize: 8, color: '#9CA3AF', marginBottom: 2 },
  value:       { fontSize: 10, color: '#111827' },
  bold:        { fontFamily: 'Helvetica-Bold' },
  amountBox:   { backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4', borderRadius: 6, padding: 12, marginVertical: 10 },
  amountValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0F766E' },
  wordsLine:   { fontSize: 9, color: '#4B5563', marginTop: 4, fontFamily: 'Helvetica-Oblique' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 4, paddingHorizontal: 4, marginTop: 4 },
  tableRow:    { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  colInv:      { width: '70%' },
  colAmt:      { width: '30%', textAlign: 'right' },
  notesBox:    { marginTop: 10, fontSize: 9, color: '#4B5563' },
  footer:      { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 8, color: '#9CA3AF', textAlign: 'center' },
  signRow:     { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 40 },
  signLine:    { width: '40%', borderTopWidth: 1, borderTopColor: '#9CA3AF', paddingTop: 4, textAlign: 'center', fontSize: 8, color: '#6B7280' },
})

interface Props {
  data: VoucherData
  labels: VoucherDocLabels
}

export function PaymentVoucherDocument({ data, labels }: Props) {
  const partyLabel = data.kind === 'RECEIPT' ? labels.receivedFrom : labels.paidTo
  return (
    <Document title={`${data.title} — ${data.partyName}`} author={data.businessName}>
      <Page size="A4" style={s.page}>

        {/* Header: business name + voucher title */}
        <View style={s.headerRow}>
          <Text style={s.businessName}>{data.businessName}</Text>
          <Text style={s.voucherTitle}>{data.title}</Text>
        </View>
        <View style={s.divider} />

        {/* Party + meta */}
        <View style={s.row2col}>
          <View>
            <Text style={s.label}>{partyLabel}</Text>
            <Text style={[s.value, s.bold]}>{data.partyName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.label}>{labels.date}</Text>
            <Text style={[s.value, s.bold]}>{fmtDate(data.date)}</Text>
          </View>
        </View>

        {/* Amount block */}
        <View style={s.amountBox}>
          <Text style={s.label}>{labels.amount}</Text>
          <Text style={s.amountValue}>{fmtPaise(data.amount)}</Text>
          <Text style={s.wordsLine}>{labels.inWords}: {data.amountInWords}</Text>
        </View>

        {/* Mode + reference */}
        <View style={s.row2col}>
          <View>
            <Text style={s.label}>{labels.paymentMode}</Text>
            <Text style={s.value}>{data.modeLabel}</Text>
          </View>
          {data.referenceNumber && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.label}>{labels.reference}</Text>
              <Text style={s.value}>{data.referenceNumber}</Text>
            </View>
          )}
        </View>

        {/* Allocations */}
        {data.allocations.length > 0 && (
          <View>
            <View style={s.tableHeader}>
              <Text style={[s.colInv, s.bold]}>{labels.appliedTo}</Text>
              <Text style={[s.colAmt, s.bold]}>{labels.amount}</Text>
            </View>
            {data.allocations.map((a) => (
              <View key={a.invoiceNumber} style={s.tableRow}>
                <Text style={s.colInv}>{a.invoiceNumber}</Text>
                <Text style={s.colAmt}>{fmtPaise(a.amount)}</Text>
              </View>
            ))}
            {data.unallocatedAmount > 0 && (
              <View style={s.tableRow}>
                <Text style={[s.colInv, { color: '#6B7280' }]}>{labels.unallocated}</Text>
                <Text style={[s.colAmt, { color: '#6B7280' }]}>{fmtPaise(data.unallocatedAmount)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={s.notesBox}>
            <Text style={s.label}>{labels.notes}</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        {/* Signature */}
        <View style={s.signRow}>
          <Text style={s.signLine}>{data.businessName}</Text>
        </View>

        <Text style={s.footer} render={({ pageNumber, totalPages }) =>
          `${labels.generatedBy}  |  ${pageNumber} / ${totalPages}`
        } />
      </Page>
    </Document>
  )
}
