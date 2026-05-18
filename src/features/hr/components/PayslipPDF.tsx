/** PayslipPDF — Phase 6 PR6 FE
 *
 * Renders an A5 payslip Document from a PayslipSnapshotPayload using
 * `@react-pdf/renderer`. The snapshot was frozen at finalize time on the
 * BE; we don't recompute, we just lay out.
 *
 * Layout (A5 portrait — 148 × 210 mm, ~420 × 595 pt):
 *
 *   Header: business name + payslip title + period
 *   Employee block: name + designation + phone
 *   Lines table: PRESENT / HALF / OT-MIN / GROSS / ADV / DED / NET
 *   Payment block: mode + date + finalized-by
 *   Footer: schemaVersion stamp
 *
 * Money is rendered as "Rs 1,500.00" (Intl with INR currency). Date as
 * yyyy-mm-dd (raw — no locale tricks; the PDF is the legal record).
 *
 * IMPORTANT: this component must NOT touch i18n hooks — react-pdf renders
 * to PDF, not React; hooks would break. Strings are passed in via props as
 * a `labels` object so the parent can resolve them via `useLanguage()`.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { PayslipSnapshotPayload } from '../payroll.types'

export interface PayslipPDFLabels {
  payslipTitle: string
  periodLabel: string
  employeeLabel: string
  designationLabel: string
  phoneLabel: string
  presentLabel: string
  halfLabel: string
  overtimeMinLabel: string
  grossLabel: string
  advanceLabel: string
  deductionsLabel: string
  netLabel: string
  paymentLabel: string
  paymentModeLabel: string
  paymentDateLabel: string
  finalizedByLabel: string
  footerNote: string
}

interface PayslipPDFProps {
  snapshot: PayslipSnapshotPayload
  labels: PayslipPDFLabels
}

const COLOR_TEXT = '#111111'
const COLOR_MUTED = '#666666'
const COLOR_BORDER = '#cccccc'
const COLOR_HEAD_BG = '#f3f4f6'

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 9,
    color: COLOR_TEXT,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER,
  },
  businessName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  payslipTitle: { fontSize: 10, color: COLOR_MUTED },
  period: { fontSize: 9, marginTop: 4 },
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 9,
    color: COLOR_MUTED,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { color: COLOR_MUTED },
  value: { color: COLOR_TEXT, fontWeight: 500 },
  table: {
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    marginTop: 4,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: COLOR_HEAD_BG,
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER,
  },
  tableRowLast: { flexDirection: 'row' },
  th: { padding: 4, flex: 1, fontWeight: 700 },
  thRight: { padding: 4, flex: 1, fontWeight: 700, textAlign: 'right' },
  td: { padding: 4, flex: 1 },
  tdRight: { padding: 4, flex: 1, textAlign: 'right' },
  netRow: {
    flexDirection: 'row',
    backgroundColor: COLOR_HEAD_BG,
    padding: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLOR_BORDER,
  },
  netLabel: { flex: 1, fontWeight: 700 },
  netValue: { flex: 1, textAlign: 'right', fontWeight: 700 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLOR_BORDER,
    fontSize: 7,
    color: COLOR_MUTED,
    textAlign: 'center',
  },
})

function rupees(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)
}

export function PayslipPDF({ snapshot, labels }: PayslipPDFProps) {
  const { business, employee, period, lines, payment, finalizedBy, finalizedAt } = snapshot

  return (
    <Document title={`Payslip ${employee.name} ${period.fromDate}_${period.toDate}`} author={business.name}>
      <Page size="A5" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.businessName}>{business.name}</Text>
          <Text style={styles.payslipTitle}>{labels.payslipTitle}</Text>
          <Text style={styles.period}>
            {labels.periodLabel}: {period.fromDate} → {period.toDate}
          </Text>
        </View>

        {/* Employee */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.employeeLabel}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{labels.employeeLabel}</Text>
            <Text style={styles.value}>{employee.name}</Text>
          </View>
          {employee.designation && (
            <View style={styles.row}>
              <Text style={styles.label}>{labels.designationLabel}</Text>
              <Text style={styles.value}>{employee.designation}</Text>
            </View>
          )}
          {employee.phone && (
            <View style={styles.row}>
              <Text style={styles.label}>{labels.phoneLabel}</Text>
              <Text style={styles.value}>{employee.phone}</Text>
            </View>
          )}
        </View>

        {/* Lines table */}
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={styles.th}>{labels.presentLabel}</Text>
              <Text style={styles.th}>{labels.halfLabel}</Text>
              <Text style={styles.th}>{labels.overtimeMinLabel}</Text>
              <Text style={styles.thRight}>{labels.grossLabel}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.td}>{lines.presentDays}</Text>
              <Text style={styles.td}>{lines.halfDays}</Text>
              <Text style={styles.td}>{lines.overtimeMin}</Text>
              <Text style={styles.tdRight}>{rupees(lines.grossPaise)}</Text>
            </View>
            <View style={styles.tableHead}>
              <Text style={styles.thRight}>{labels.advanceLabel}</Text>
              <Text style={styles.thRight}>{labels.deductionsLabel}</Text>
            </View>
            <View style={styles.tableRowLast}>
              <Text style={styles.tdRight}>{rupees(lines.advanceTotalPaise)}</Text>
              <Text style={styles.tdRight}>{rupees(lines.deductionsPaise)}</Text>
            </View>
          </View>

          {/* Net */}
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>{labels.netLabel}</Text>
            <Text style={styles.netValue}>{rupees(lines.netPaise)}</Text>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.paymentLabel}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{labels.paymentModeLabel}</Text>
            <Text style={styles.value}>{payment.mode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{labels.paymentDateLabel}</Text>
            <Text style={styles.value}>{payment.date.slice(0, 10)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{labels.finalizedByLabel}</Text>
            <Text style={styles.value}>{finalizedBy.name ?? finalizedBy.userId}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          {labels.footerNote} · {finalizedAt.slice(0, 10)} · schema v{snapshot.schemaVersion}
        </Text>
      </Page>
    </Document>
  )
}
