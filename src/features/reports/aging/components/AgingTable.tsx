/** Aging report — the bucket grid (≥md).
 *
 * Archetype O: all five money columns stay visible with a totals row. The
 * phone view (AgingRow) collapses them to "oldest bucket + total" instead,
 * because five columns at 320px is either a horizontal scroll or 8px text.
 */

import { ResponsiveTable, type TableColumn } from '@/components/layout/ResponsiveTable'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { AgingRow } from '../../finance.types'
import { sumRows } from '../aging.utils'

interface AgingTableProps {
  rows: AgingRow[]
  onRowClick?: (row: AgingRow) => void
  label: string
}

export function AgingTable({ rows, onRowClick, label }: AgingTableProps) {
  const { t } = useLanguage()
  const totals = sumRows(rows)

  const money = (paise: number) => <span className="tabular-nums">{formatPaise(paise)}</span>

  const columns: TableColumn<AgingRow>[] = [
    {
      key: 'party',
      header: t.party,
      render: (row) => <span className="aging-table__party">{row.partyName}</span>,
    },
    { key: 'current', header: t.current, align: 'right', render: (row) => money(row.current) },
    { key: 'd31', header: t.days31to60, align: 'right', render: (row) => money(row.days31to60) },
    { key: 'd61', header: t.days61to90, align: 'right', render: (row) => money(row.days61to90) },
    {
      key: 'over90',
      header: t.over90,
      align: 'right',
      render: (row) => (
        <span className={`tabular-nums${row.over90 > 0 ? ' aging-table__danger' : ''}`}>
          {formatPaise(row.over90)}
        </span>
      ),
    },
    {
      key: 'total',
      header: t.total,
      align: 'right',
      render: (row) => <strong className="tabular-nums">{formatPaise(row.total)}</strong>,
    },
  ]

  return (
    <div className="aging-table" aria-label={label}>
      <ResponsiveTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.partyId}
        onRowClick={onRowClick}
        alwaysTable
        density="compact"
        zebra
      />

      <div className="aging-table__totals" aria-label={t.total}>
        <span className="aging-table__totals-label">{t.total}</span>
        <span className="tabular-nums">{formatPaise(totals.current)}</span>
        <span className="tabular-nums">{formatPaise(totals.days31to60)}</span>
        <span className="tabular-nums">{formatPaise(totals.days61to90)}</span>
        <span className="tabular-nums">{formatPaise(totals.over90)}</span>
        <strong className="tabular-nums">{formatPaise(totals.total)}</strong>
      </div>
    </div>
  )
}
