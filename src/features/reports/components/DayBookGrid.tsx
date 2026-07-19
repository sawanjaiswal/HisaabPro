/** Day Book — dense transaction view (archetype O, mobile-first).
 *
 *   <md : one dense row per txn — Time + colored Type + Particulars on the left,
 *         Amount pinned right and ALWAYS visible (no horizontal scroll). This is
 *         the primary view: on a phone the money must never fall off-screen.
 *   ≥md : the full multi-column accounting grid (adds a Reference column) via
 *         ResponsiveTable, where the extra width exists.
 *
 * Money is signed by cash direction:
 *   inflow  (sale, payment_in)               → success green, "+"
 *   outflow (purchase, payment_out, expense) → error red,     "−"
 *   neutral (stock_adjustment)               → primary text, native sign
 */

import { ResponsiveTable } from '@/components/layout/ResponsiveTable'
import type { TableColumn } from '@/components/layout/ResponsiveTable'
import { formatAmount } from '../report.utils'
import { DAY_BOOK_TYPE_COLORS, DAY_BOOK_TYPE_LABELS } from '../report.constants'
import type {
  DayBookTransaction,
  DayBookTransactionType,
  DayBookSummary,
} from '../report-daybook.types'
import { useLanguage } from '@/hooks/useLanguage'

type Direction = 'in' | 'out' | 'neutral'

const DIRECTION: Record<DayBookTransactionType, Direction> = {
  sale:             'in',
  payment_in:       'in',
  purchase:         'out',
  payment_out:      'out',
  expense:          'out',
  stock_adjustment: 'neutral',
}

const DIRECTION_COLOR: Record<Direction, string> = {
  in:      'var(--color-success-600)',
  out:     'var(--color-error-600)',
  neutral: 'var(--text-primary)',
}

const DIRECTION_SIGN: Record<Direction, string> = { in: '+', out: '−', neutral: '' }

/** Signed, direction-coloured amount text. Neutral rows keep the native sign. */
function amountFor(txn: DayBookTransaction): { text: string; color: string } {
  const dir = DIRECTION[txn.type]
  const text =
    dir === 'neutral'
      ? formatAmount(txn.amount)
      : `${DIRECTION_SIGN[dir]}${formatAmount(Math.abs(txn.amount))}`
  return { text, color: DIRECTION_COLOR[dir] }
}

interface DayBookGridProps {
  transactions: DayBookTransaction[]
  summary: DayBookSummary
  density: 'comfortable' | 'compact'
  emptyLabel: string
}

export function DayBookGrid({ transactions, summary, density, emptyLabel }: DayBookGridProps) {
  const { t } = useLanguage()
  const rowPad = density === 'compact' ? 'py-1.5' : 'py-2.5'

  const columns: TableColumn<DayBookTransaction>[] = [
    {
      key: 'time',
      header: t.time,
      width: 'w-14',
      render: (txn) => (
        <span className="text-[var(--fs-xs)]" style={{ color: 'var(--text-muted)' }}>
          {txn.time}
        </span>
      ),
    },
    {
      key: 'type',
      header: t.typeLabel,
      width: 'w-24',
      render: (txn) => (
        <span
          className="text-[var(--fs-xs)] font-medium whitespace-nowrap"
          style={{ color: DAY_BOOK_TYPE_COLORS[txn.type] }}
        >
          {DAY_BOOK_TYPE_LABELS[txn.type]}
        </span>
      ),
    },
    {
      key: 'particulars',
      header: t.particulars,
      render: (txn) => (
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="truncate" style={{ color: 'var(--text-primary)' }}>
            {txn.description}
          </span>
          {txn.partyName && (
            <span
              className="text-[var(--fs-xs)] truncate shrink-0 max-w-[40%]"
              style={{ color: 'var(--text-muted)' }}
            >
              · {txn.partyName}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'reference',
      header: t.reference,
      width: 'w-28',
      render: (txn) =>
        txn.reference ? (
          <span className="text-[var(--fs-xs)] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {txn.reference}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'amount',
      header: t.amount,
      align: 'right',
      width: 'w-28',
      render: (txn) => {
        const { text, color } = amountFor(txn)
        return (
          <span className="font-semibold" style={{ color }}>
            {text}
          </span>
        )
      },
    },
  ]

  const netPositive = summary.netCashFlow >= 0

  return (
    <div className="day-book-grid">
      {/* Mobile-first dense rows (<md) — amount pinned right, always visible */}
      <ul className="md:hidden" aria-label={t.dayBookTransactions}>
        {transactions.map((txn, i) => {
          const { text, color } = amountFor(txn)
          return (
            <li
              key={txn.id}
              className={`flex items-center justify-between gap-3 px-3 ${rowPad}`}
              style={{
                borderBottom: '1px solid var(--color-gray-100)',
                backgroundColor: i % 2 === 1 ? 'var(--color-gray-50)' : undefined,
              }}
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[var(--fs-xs)] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {txn.time}
                  </span>
                  <span
                    className="text-[var(--fs-xs)] font-medium whitespace-nowrap"
                    style={{ color: DAY_BOOK_TYPE_COLORS[txn.type] }}
                  >
                    {DAY_BOOK_TYPE_LABELS[txn.type]}
                  </span>
                </div>
                <div className="text-[var(--fs-sm)] truncate" style={{ color: 'var(--text-primary)' }}>
                  {txn.description}
                  {txn.partyName && (
                    <span style={{ color: 'var(--text-muted)' }}> · {txn.partyName}</span>
                  )}
                </div>
              </div>
              <span
                className="text-[var(--fs-sm)] font-semibold tabular-nums shrink-0"
                style={{ color }}
              >
                {text}
              </span>
            </li>
          )
        })}
      </ul>

      {/* Full accounting grid (≥md) — adds Reference, horizontal room exists */}
      <div className="hidden md:block">
        <ResponsiveTable
          columns={columns}
          rows={transactions}
          rowKey={(txn) => txn.id}
          density={density}
          alwaysTable
          zebra
          empty={<span style={{ color: 'var(--text-muted)' }}>{emptyLabel}</span>}
        />
      </div>

      {/* Totals strip — net cash flow */}
      <div
        className="flex items-center justify-between px-3 py-2 mt-px"
        style={{
          backgroundColor: 'var(--color-gray-50)',
          borderTop: '1px solid var(--color-gray-100)',
        }}
      >
        <span className="text-[var(--fs-sm)] font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t.netCash}
        </span>
        <span
          className="text-[var(--fs-df)] font-bold tabular-nums"
          style={{ color: netPositive ? 'var(--color-success-600)' : 'var(--color-error-600)' }}
        >
          {netPositive ? '+' : '−'}
          {formatAmount(Math.abs(summary.netCashFlow))}
        </span>
      </div>
    </div>
  )
}
