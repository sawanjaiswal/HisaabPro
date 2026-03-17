/** Single transaction row in the party statement ledger */

import { STATEMENT_TYPE_LABELS, STATEMENT_TYPE_COLORS } from '../report.constants'
import { formatAmount, formatReportDate } from '../report.utils'
import type { StatementTransaction } from '../report.types'

export interface StatementRowProps {
  txn: StatementTransaction
  onNavigate: (referenceId: string, type: StatementTransaction['type']) => void
}

export function StatementRow({ txn, onNavigate }: StatementRowProps) {
  const typeColor = STATEMENT_TYPE_COLORS[txn.type]
  const isReceivable = txn.runningBalance >= 0

  return (
    <div
      className="report-statement-row"
      role="listitem"
      onClick={() => onNavigate(txn.referenceId, txn.type)}
      style={{ cursor: 'pointer' }}
      aria-label={`${STATEMENT_TYPE_LABELS[txn.type]}: ${txn.description}`}
    >
      <div
        className="report-statement-type-dot"
        style={{ background: typeColor }}
        aria-hidden="true"
      />
      <div className="report-statement-meta">
        <div className="report-statement-description">{txn.description}</div>
        <div
          className="report-statement-reference"
          style={{ color: typeColor }}
        >
          {STATEMENT_TYPE_LABELS[txn.type]} · {txn.reference}
        </div>
        <div className="report-statement-date">{formatReportDate(txn.date)}</div>
      </div>
      <div className="report-statement-amounts">
        {txn.debit > 0 ? (
          <span className="report-statement-debit">{formatAmount(txn.debit)}</span>
        ) : (
          <span className="report-statement-debit" style={{ opacity: 0.3 }}>—</span>
        )}
        {txn.credit > 0 ? (
          <span className="report-statement-credit">{formatAmount(txn.credit)}</span>
        ) : (
          <span className="report-statement-credit" style={{ opacity: 0.3 }}>—</span>
        )}
        <span
          className={`report-statement-balance ${
            isReceivable
              ? 'report-statement-balance--receivable'
              : 'report-statement-balance--payable'
          }`}
        >
          {formatAmount(Math.abs(txn.runningBalance))}
        </span>
      </div>
      <div className="report-divider" />
    </div>
  )
}
