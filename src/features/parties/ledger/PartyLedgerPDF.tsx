/**
 * PartyLedgerPDF — React-PDF Document for party ledger export.
 *
 * Uses <Text> exclusively — no dangerouslySetInnerHTML.
 * Manual Indian number formatting (Intl unavailable in react-pdf renderer).
 * Page break every 40 rows.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { LedgerResponse, LedgerRow, LedgerVoucherType } from './ledger.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPaise(paise: number): string {
  const abs = Math.abs(paise)
  const rupees = abs / 100
  const [intPart, decPart] = rupees.toFixed(2).split('.')
  const n = intPart ?? '0'
  let result = ''
  const len = n.length
  if (len <= 3) {
    result = n
  } else {
    result = n.slice(0, len - 3)
    const rem = n.slice(len - 3)
    let idx = 0
    let grouped = ''
    for (let i = result.length - 1; i >= 0; i--) {
      grouped = result[i] + grouped
      idx++
      if (idx % 2 === 0 && i !== 0) grouped = ',' + grouped
    }
    result = grouped + ',' + rem
  }
  const prefix = paise < 0 ? '-Rs ' : 'Rs '
  return `${prefix}${result}.${decPart}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function balanceLbl(paise: number): string {
  if (paise === 0) return `${fmtPaise(0)} Nil`
  return paise > 0
    ? `${fmtPaise(Math.abs(paise))} Dr`
    : `${fmtPaise(Math.abs(paise))} Cr`
}

const TYPE_LABEL: Record<LedgerVoucherType, string> = {
  SALE:        'Sale',
  PURCHASE:    'Purchase',
  PAYMENT:     'Payment',
  RECEIPT:     'Receipt',
  CREDIT_NOTE: 'Cr Note',
  DEBIT_NOTE:  'Dr Note',
  JOURNAL:     'Journal',
  OPENING:     'Opening',
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:         { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#111827' },
  heading:      { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subheading:   { fontSize: 9, color: '#4B5563', marginBottom: 2 },
  meta:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  divider:      { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 8 },
  tableHeader:  {
    flexDirection: 'row', backgroundColor: '#F3F4F6',
    paddingVertical: 4, paddingHorizontal: 2,
  },
  tableRow:     {
    flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 2,
    borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6',
  },
  summaryRow:   {
    flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 2,
    backgroundColor: '#F9FAFB',
    fontFamily: 'Helvetica-Bold',
  },
  colDate:      { width: '11%' },
  colType:      { width: '10%' },
  colPart:      { width: '29%' },
  colVoucher:   { width: '14%' },
  colDr:        { width: '12%', textAlign: 'right' },
  colCr:        { width: '12%', textAlign: 'right' },
  colBal:       { width: '12%', textAlign: 'right' },
  footer: {
    position: 'absolute', bottom: 20, left: 32, right: 32,
    fontSize: 7, color: '#9CA3AF', textAlign: 'center',
  },
})

// ─── Component ────────────────────────────────────────────────────────────────

interface PartyLedgerPDFProps {
  data: LedgerResponse
  businessName: string
}

const ROWS_PER_PAGE = 40

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

function TableHeader() {
  return (
    <View style={s.tableHeader}>
      <Text style={s.colDate}>Date</Text>
      <Text style={s.colType}>Type</Text>
      <Text style={s.colPart}>Particulars</Text>
      <Text style={s.colVoucher}>Voucher#</Text>
      <Text style={s.colDr}>Debit</Text>
      <Text style={s.colCr}>Credit</Text>
      <Text style={s.colBal}>Balance</Text>
    </View>
  )
}

function LedgerRowView({ row, idx }: { row: LedgerRow; idx: number }) {
  const bg = idx % 2 === 1 ? { backgroundColor: '#FAFAFA' } : {}
  return (
    <View style={[s.tableRow, bg]}>
      <Text style={s.colDate}>{fmtDate(row.date)}</Text>
      <Text style={s.colType}>{TYPE_LABEL[row.voucherType] ?? row.voucherType}</Text>
      <Text style={s.colPart}>{row.particulars}</Text>
      <Text style={s.colVoucher}>{row.voucherNumber}</Text>
      <Text style={s.colDr}>{row.dr > 0 ? fmtPaise(row.dr) : ''}</Text>
      <Text style={s.colCr}>{row.cr > 0 ? fmtPaise(row.cr) : ''}</Text>
      <Text style={s.colBal}>{balanceLbl(row.runningBalance)}</Text>
    </View>
  )
}

export function PartyLedgerPDF({ data, businessName }: PartyLedgerPDFProps) {
  const pages = chunk(data.rows, ROWS_PER_PAGE)
  // Ensure at least one page
  const pageList = pages.length > 0 ? pages : [[]]

  return (
    <Document
      title={`Ledger — ${data.partyName} — ${data.fromDate} to ${data.toDate}`}
      author={businessName}
    >
      {pageList.map((pageRows, pageIdx) => (
        <Page key={pageIdx} size="A4" style={s.page}>
          {/* Header — first page only */}
          {pageIdx === 0 && (
            <>
              <Text style={s.heading}>{businessName}</Text>
              <Text style={s.subheading}>
                Account Ledger: {data.partyName}
              </Text>
              <View style={s.meta}>
                <Text style={{ color: '#4B5563' }}>
                  Period: {fmtDate(data.fromDate)} to {fmtDate(data.toDate)}
                </Text>
                <Text style={{ color: '#4B5563' }}>
                  Opening: {balanceLbl(data.openingBalance)}
                </Text>
              </View>
              <View style={s.divider} />
            </>
          )}

          <TableHeader />

          {/* Opening balance row on first page */}
          {pageIdx === 0 && (
            <View style={s.summaryRow}>
              <Text style={s.colDate}>—</Text>
              <Text style={s.colType}>—</Text>
              <Text style={s.colPart}>Opening Balance</Text>
              <Text style={s.colVoucher} />
              <Text style={s.colDr} />
              <Text style={s.colCr} />
              <Text style={s.colBal}>{balanceLbl(data.openingBalance)}</Text>
            </View>
          )}

          {pageRows.map((row, idx) => (
            <LedgerRowView key={row.id} row={row} idx={idx} />
          ))}

          {/* Closing balance on last page */}
          {pageIdx === pageList.length - 1 && (
            <View style={s.summaryRow}>
              <Text style={s.colDate}>—</Text>
              <Text style={s.colType}>—</Text>
              <Text style={s.colPart}>Closing Balance</Text>
              <Text style={s.colVoucher} />
              <Text style={s.colDr} />
              <Text style={s.colCr} />
              <Text style={s.colBal}>{balanceLbl(data.closingBalance)}</Text>
            </View>
          )}

          <Text
            style={s.footer}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}  |  Generated by HisaabPro`
            }
          />
        </Page>
      ))}
    </Document>
  )
}
