/**
 * StatementPDFTemplate — React-PDF Document for customer account statement.
 *
 * Uses <Text> exclusively — no dangerouslySetInnerHTML.
 * React-PDF auto-escapes all text content, safe against XSS.
 * Page break triggered every 50 rows.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { StatementData } from './statement.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format paise as Indian rupee: Rs 1,00,000.00 */
function fmtPaise(paise: number): string {
  const abs = Math.abs(paise)
  const rupees = abs / 100
  // Build Indian format manually (Intl unavailable in react-pdf renderer)
  const [intPart, decPart] = rupees.toFixed(2).split('.')
  const n = intPart ?? '0'
  let result = ''
  const len = n.length
  if (len <= 3) {
    result = n
  } else {
    result = n.slice(0, len - 3)
    const rem = n.slice(len - 3)
    // Group remaining left digits in groups of 2
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#111827' },
  heading:     { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subheading:  { fontSize: 10, color: '#4B5563', marginBottom: 2 },
  section:     { marginBottom: 12 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label:       { color: '#6B7280' },
  divider:     { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 8 },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 4, paddingHorizontal: 2 },
  tableRow:    { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 2, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  colDate:     { width: '12%' },
  colRef:      { width: '14%' },
  colDesc:     { width: '28%' },
  colDebit:    { width: '14%', textAlign: 'right' },
  colCredit:   { width: '14%', textAlign: 'right' },
  colBalance:  { width: '18%', textAlign: 'right' },
  // Totals
  balanceRow:  { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  balanceLabel:{ fontFamily: 'Helvetica-Bold', marginRight: 8 },
  balanceAmt:  { fontFamily: 'Helvetica-Bold', textDecoration: 'underline', minWidth: 80, textAlign: 'right' },
  footer:      { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7, color: '#9CA3AF', textAlign: 'center' },
})

// ─── Component ────────────────────────────────────────────────────────────────

const PAGE_ROW_LIMIT = 50

export function StatementPDFTemplate({ data }: { data: StatementData }) {
  const { party, business, period, openingBalancePaise, transactions, closingBalancePaise, generatedAt } = data

  // Split transactions into pages of PAGE_ROW_LIMIT rows
  const pages: typeof transactions[] = []
  for (let i = 0; i < Math.max(1, transactions.length); i += PAGE_ROW_LIMIT) {
    pages.push(transactions.slice(i, i + PAGE_ROW_LIMIT))
  }

  return (
    <Document title={`Statement — ${party.name}`} author={business.name}>
      {pages.map((pageRows, pageIdx) => (
        <Page key={pageIdx} size="A4" style={s.page}>
          {/* ── Header ── */}
          {pageIdx === 0 && (
            <>
              <View style={s.section}>
                <Text style={s.heading}>{business.name}</Text>
                {business.gstin ? <Text style={s.subheading}>{`GSTIN: ${business.gstin}`}</Text> : null}
                {business.phone ? <Text style={s.subheading}>{`Phone: ${business.phone}`}</Text> : null}
              </View>
              <View style={s.divider} />

              {/* Party info */}
              <View style={s.section}>
                <View style={s.row}>
                  <View>
                    <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>{`To: ${party.name}`}</Text>
                    {party.phone ? <Text style={s.label}>{`Phone: ${party.phone}`}</Text> : null}
                    {party.email ? <Text style={s.label}>{`Email: ${party.email}`}</Text> : null}
                    {party.gstin ? <Text style={s.label}>{`GSTIN: ${party.gstin}`}</Text> : null}
                    {party.billingAddress ? <Text style={s.label}>{party.billingAddress}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.label}>{'Statement Period'}</Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>{`${fmtDate(period.from)} — ${fmtDate(period.to)}`}</Text>
                  </View>
                </View>
              </View>
              <View style={s.divider} />

              {/* Opening balance */}
              <View style={[s.balanceRow, { marginBottom: 8 }]}>
                <Text style={s.balanceLabel}>{'Opening Balance:'}</Text>
                <Text style={s.balanceAmt}>{fmtPaise(openingBalancePaise)}</Text>
              </View>
            </>
          )}

          {/* ── Table header ── */}
          <View style={s.tableHeader}>
            <Text style={s.colDate}>{'Date'}</Text>
            <Text style={s.colRef}>{'Reference'}</Text>
            <Text style={s.colDesc}>{'Description'}</Text>
            <Text style={s.colDebit}>{'Debit'}</Text>
            <Text style={s.colCredit}>{'Credit'}</Text>
            <Text style={s.colBalance}>{'Balance'}</Text>
          </View>

          {/* ── Rows ── */}
          {pageRows.length === 0 && (
            <View style={{ padding: 16 }}>
              <Text style={{ color: '#6B7280', textAlign: 'center' }}>{'No transactions in this period.'}</Text>
            </View>
          )}
          {pageRows.map((tx, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.colDate}>{fmtDate(tx.date)}</Text>
              <Text style={s.colRef}>{tx.reference}</Text>
              <Text style={s.colDesc}>{tx.description}</Text>
              <Text style={s.colDebit}>{tx.debitPaise > 0 ? fmtPaise(tx.debitPaise) : ''}</Text>
              <Text style={s.colCredit}>{tx.creditPaise > 0 ? fmtPaise(tx.creditPaise) : ''}</Text>
              <Text style={s.colBalance}>{fmtPaise(tx.balancePaise)}</Text>
            </View>
          ))}

          {/* ── Closing balance (last page only) ── */}
          {pageIdx === pages.length - 1 && (
            <>
              <View style={s.divider} />
              <View style={s.balanceRow}>
                <Text style={s.balanceLabel}>{'Closing Balance:'}</Text>
                <Text style={s.balanceAmt}>{fmtPaise(closingBalancePaise)}</Text>
              </View>
            </>
          )}

          {/* ── Footer ── */}
          <Text style={s.footer}>
            {`Computer-generated statement. As of ${new Date(generatedAt).toLocaleDateString('en-IN')}. Amounts in INR. Page ${pageIdx + 1} of ${pages.length}`}
          </Text>
        </Page>
      ))}
    </Document>
  )
}
