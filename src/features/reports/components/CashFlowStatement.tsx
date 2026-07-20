/** Cash Flow — the inflow / outflow statement card (mockup #69).
 *
 * Two labelled groups closed by a bold total (inflows green, outflows red),
 * then the net movement and the opening / closing cash it reconciles to.
 * Zero rows are kept: a statement that hides "Other Inflows ₹0" reads as if
 * the line does not exist.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { CashFlowData } from '../finance.types'

interface StatementRow {
  key: string
  label: string
  amount: number
}

interface CashFlowStatementProps {
  data: CashFlowData
}

function Group({
  title,
  rows,
  totalLabel,
  totalAmount,
  tone,
}: {
  title: string
  rows: StatementRow[]
  totalLabel: string
  totalAmount: number
  tone: 'in' | 'out'
}) {
  return (
    <div className="cf-group py-0">
      <h2 className="cf-group__title">{title}</h2>

      <dl className="cf-group__rows">
        {rows.map((row) => (
          <div key={row.key} className="cf-row">
            <dt className="cf-row__label">{row.label}</dt>
            <dd className="cf-row__amount">{formatPaise(row.amount)}</dd>
          </div>
        ))}
      </dl>

      <div className={`cf-row cf-row--total cf-row--${tone}`}>
        <span className="cf-row__label">{totalLabel}</span>
        <span className="cf-row__amount">{formatPaise(totalAmount)}</span>
      </div>
    </div>
  )
}

export function CashFlowStatement({ data }: CashFlowStatementProps) {
  const { t } = useLanguage()

  const inflowRows: StatementRow[] = [
    { key: 'sales', label: t.cashSales, amount: data.inflows.cashSales },
    { key: 'received', label: t.receivablesReceived, amount: data.inflows.receivablesReceived },
    { key: 'other', label: t.otherInflows, amount: data.inflows.other },
  ]

  const outflowRows: StatementRow[] = [
    { key: 'purchases', label: t.purchasesLabel, amount: data.outflows.purchases },
    { key: 'expenses', label: t.expensesLabel, amount: data.outflows.expenses },
    { key: 'other', label: t.otherOutflows, amount: data.outflows.other },
  ]

  return (
    <section className="cf-statement py-0" aria-label={t.cashFlow}>
      <Group
        title={t.cashInflows}
        rows={inflowRows}
        totalLabel={t.totalInflows}
        totalAmount={data.inflows.total}
        tone="in"
      />

      <Group
        title={t.cashOutflows}
        rows={outflowRows}
        totalLabel={t.totalOutflows}
        totalAmount={data.outflows.total}
        tone="out"
      />

      <div className="cf-reconcile">
        <div className="cf-row cf-row--net">
          <span className="cf-row__label">{t.netCashFlow}</span>
          <span className="cf-row__amount">{formatPaise(data.netCashFlow)}</span>
        </div>

        <dl className="cf-group__rows">
          <div className="cf-row">
            <dt className="cf-row__label">{t.openingCash}</dt>
            <dd className="cf-row__amount">{formatPaise(data.openingCash)}</dd>
          </div>
          <div className="cf-row">
            <dt className="cf-row__label">{t.closingCash}</dt>
            <dd className="cf-row__amount">{formatPaise(data.closingCash)}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
