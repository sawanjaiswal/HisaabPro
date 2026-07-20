/** One statement row — tinted icon square + amount (mockup #47).
 *
 * The mockup prints a settlement word ("Unpaid") beside invoices. We only
 * know settlement for the ledger as a whole, not per document, so the row
 * shows the running balance instead — the honest per-row equivalent, and the
 * number a shopkeeper reading a statement is actually reconciling against.
 */

import { ArrowDownLeft, ArrowUpRight, FileText, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { STATEMENT_TYPE_LABELS } from '../report.constants'
import { formatAmount, formatReportDate } from '../report.utils'
import { statementRowAmount, statementRowTone } from '../statement-view.utils'
import type { StatementTransaction } from '../report.types'

export interface StatementRowProps {
  txn: StatementTransaction
  onNavigate: (referenceId: string, type: StatementTransaction['type']) => void
}

function iconFor(txn: StatementTransaction) {
  if (txn.type === 'credit_note' || txn.type === 'debit_note') return <RotateCcw size={20} />
  if (txn.type === 'payment_received') return <ArrowDownLeft size={20} />
  if (txn.type === 'payment_made') return <ArrowUpRight size={20} />
  return <FileText size={20} />
}

export function StatementRow({ txn, onNavigate }: StatementRowProps) {
  const { t } = useLanguage()
  const tone = statementRowTone(txn)
  const amount = statementRowAmount(txn)
  const label = STATEMENT_TYPE_LABELS[txn.type]

  return (
    <Button
      variant="none"
      type="button"
      className="statement-row"
      role="listitem"
      onClick={() => onNavigate(txn.referenceId, txn.type)}
      aria-label={`${label} ${txn.reference}`}
    >
      <span className={`statement-row__icon statement-row__icon--${tone}`} aria-hidden="true">
        {iconFor(txn)}
      </span>

      <span className="statement-row__info">
        <span className="statement-row__title">{txn.reference || label}</span>
        <span className="statement-row__meta">
          {label} · {formatReportDate(txn.date)}
        </span>
      </span>

      <span className="statement-row__right">
        <span className={`statement-row__amount statement-row__amount--${tone} tabular-nums`}>
          {amount < 0 ? '−' : ''}{formatAmount(Math.abs(amount))}
        </span>
        <span className="statement-row__balance tabular-nums">
          {t.balance} {formatAmount(Math.abs(txn.runningBalance))}
        </span>
      </span>
    </Button>
  )
}
