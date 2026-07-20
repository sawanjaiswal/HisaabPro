/** Profit & Loss — the Income / Expenses statement card (mockup #16).
 *
 * Two labelled groups of rows, each closed by a bold total: income totals in
 * success green, expense totals in error red. Zero-value lines are still shown
 * — a P&L that hides "Other Income ₹0" reads as if the line doesn't exist.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { ProfitLossData } from '../finance.types'

interface StatementRow {
  key: string
  label: string
  amount: number
}

interface ProfitLossStatementProps {
  data: ProfitLossData
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
  tone: 'income' | 'expense'
}) {
  return (
    <div className="pl-group py-0">
      <h2 className="pl-group__title">{title}</h2>

      <dl className="pl-group__rows">
        {rows.map((row) => (
          <div key={row.key} className="pl-row">
            <dt className="pl-row__label">{row.label}</dt>
            <dd className="pl-row__amount">{formatPaise(row.amount)}</dd>
          </div>
        ))}
      </dl>

      <div className={`pl-row pl-row--total pl-row--${tone}`}>
        <span className="pl-row__label">{totalLabel}</span>
        <span className="pl-row__amount">{formatPaise(totalAmount)}</span>
      </div>
    </div>
  )
}

export function ProfitLossStatement({ data }: ProfitLossStatementProps) {
  const { t } = useLanguage()

  const incomeRows: StatementRow[] = [
    { key: 'sales', label: t.sales, amount: data.income.sales },
    { key: 'other', label: t.otherIncomeLabel, amount: data.income.otherIncome },
  ]

  const expenseRows: StatementRow[] = [
    { key: 'purchases', label: t.purchasesLabel, amount: data.expenses.purchases },
    { key: 'direct', label: t.directExpenses, amount: data.expenses.directExpenses },
    { key: 'indirect', label: t.indirectExpenses, amount: data.expenses.indirectExpenses },
  ]

  return (
    <section className="pl-statement py-0" aria-label={t.profitAndLoss}>
      <Group
        title={t.income}
        rows={incomeRows}
        totalLabel={t.totalIncome}
        totalAmount={data.income.totalIncome}
        tone="income"
      />

      <Group
        title={t.expensesLabel}
        rows={expenseRows}
        totalLabel={t.totalExpenses}
        totalAmount={data.expenses.totalExpenses}
        tone="expense"
      />
    </section>
  )
}
