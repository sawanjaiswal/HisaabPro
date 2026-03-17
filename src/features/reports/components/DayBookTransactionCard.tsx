/** Day Book — Single transaction card */

import { formatAmount } from '../report.utils'
import {
  DAY_BOOK_TYPE_LABELS,
  DAY_BOOK_TYPE_COLORS,
} from '../report.constants'
import type { DayBookTransaction } from '../report.types'

interface DayBookTransactionCardProps {
  transaction: DayBookTransaction
}

export function DayBookTransactionCard({ transaction }: DayBookTransactionCardProps) {
  const txn = transaction

  return (
    <div className="report-card" role="listitem">
      <div className="report-card-header">
        <span className="report-daybook-time">{txn.time}</span>
        <span
          className="report-daybook-type"
          style={{ color: DAY_BOOK_TYPE_COLORS[txn.type] }}
        >
          {DAY_BOOK_TYPE_LABELS[txn.type]}
        </span>
      </div>
      <div className="report-card-body">
        <span>{txn.description}</span>
        {txn.partyName !== '' && (
          <span className="report-card-party">{txn.partyName}</span>
        )}
      </div>
      <div className="report-card-footer">
        <span className="report-card-amount">
          {formatAmount(txn.amount)}
        </span>
        {txn.reference !== '' && (
          <span className="report-card-ref">{txn.reference}</span>
        )}
      </div>
      <div className="report-divider" />
    </div>
  )
}
