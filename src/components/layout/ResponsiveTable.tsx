/**
 * ResponsiveTable — cards <md, table ≥md.
 *
 * One primitive consolidates the (currently scattered) card↔table-switch
 * pattern across feature pages. Consumers describe columns and rows; the
 * primitive owns the responsive switch.
 *
 *   <md  : each row renders as a Card with label-value pairs (one per column)
 *   ≥md  : standard table with sticky header
 *
 * Density + accounting mode (2026-07):
 *   density="compact"  → 36px rows (px-3 py-1.5) for data-dense ledgers/registers
 *   density="comfortable" (default) → the original px-4 py-3 consumer spacing
 *   alwaysTable        → render the scrollable grid at EVERY width (accounting
 *                        grids — day book, trial balance — keep columns on phone
 *                        via horizontal scroll instead of collapsing to cards)
 *   zebra              → alternating row tint for scan-ability on wide tables
 *
 * 4 UI states (loading / error / empty / data) are first-class via props so
 * feature pages don't need to wrap with extra logic.
 */

import type { ReactNode } from 'react'

export interface TableColumn<T> {
  /** Stable key — also used as the mobile-card label fallback. */
  key: string
  /** Header label for the desktop table view + mobile card label. */
  header: ReactNode
  /** Renderer for the cell value. */
  render: (row: T) => ReactNode
  /** Hide this column at <md (it'll still render in the card view unless `mobileHide`). */
  desktopOnly?: boolean
  /** Hide entirely <md. */
  mobileHide?: boolean
  /** Cell alignment (table view only). */
  align?: 'left' | 'right' | 'center'
  /** Tailwind width hint (e.g. `w-32`, `w-1/4`) for table view. */
  width?: string
}

interface ResponsiveTableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  /** Stable identity for each row. */
  rowKey: (row: T) => string
  /** Optional click handler on a row (table + card). */
  onRowClick?: (row: T) => void
  /** Loading state — pass `true` while data is fetching. */
  loading?: boolean
  /** Error state — pass an error message OR a node. */
  error?: ReactNode
  /** Empty state node — rendered when rows.length === 0 and !loading and !error. */
  empty?: ReactNode
  /** Visible skeleton rows when loading (default 5). */
  skeletonRows?: number
  /** Row/cell density. `compact` = 36px rows for data-dense accounting grids. Default `comfortable`. */
  density?: 'comfortable' | 'compact'
  /** Render the scrollable table at every width (no card collapse <md). For true accounting grids. */
  alwaysTable?: boolean
  /** Alternating row tint for scan-ability on wide tables. */
  zebra?: boolean
  className?: string
}

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  error,
  empty,
  skeletonRows = 5,
  density = 'comfortable',
  alwaysTable = false,
  zebra = false,
  className = '',
}: ResponsiveTableProps<T>) {
  if (loading) return <TableSkeleton columns={columns} rows={skeletonRows} />
  if (error) return <div className="py-6">{error}</div>
  if (rows.length === 0) return <div className="py-6">{empty}</div>

  // Compact = data-dense accounting rows (~36px); comfortable = original consumer spacing.
  const cellPad = density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-3'

  return (
    <div className={`responsive-table ${className}`.trim()}>
      {/* Mobile cards (<md) — skipped entirely when alwaysTable (accounting grid keeps columns) */}
      <div className={`${alwaysTable ? 'hidden' : 'md:hidden'} space-y-3`}>
        {rows.map((row) => (
          <button
            key={rowKey(row)}
            type="button"
            className="w-full text-left rounded-[var(--radius-xl)] p-4 border min-h-[44px]"
            style={{
              backgroundColor: 'var(--color-gray-0)',
              borderColor: 'var(--color-gray-100)',
            }}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            disabled={!onRowClick}
          >
            <dl className="space-y-2">
              {columns.filter((c) => !c.mobileHide).map((col) => (
                <div key={col.key} className="flex items-baseline justify-between gap-3">
                  <dt
                    className="text-[var(--fs-xs)] font-medium shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {col.header}
                  </dt>
                  <dd
                    className="text-[var(--fs-sm)] text-right min-w-0 truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {col.render(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </button>
        ))}
      </div>

      {/* Table view — ≥md by default, or every width when alwaysTable */}
      <div className={`${alwaysTable ? 'block' : 'hidden md:block'} overflow-x-auto`}>
        <table className="w-full text-[var(--fs-sm)]">
          <thead
            className="sticky top-0 z-10"
            style={{ backgroundColor: 'var(--color-gray-50)' }}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`${cellPad} font-medium text-${col.align ?? 'left'} ${col.width ?? ''}`}
                  style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--color-gray-100)' }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-[var(--color-gray-50)]' : ''}
                style={zebra && i % 2 === 1 ? { backgroundColor: 'var(--color-gray-50)' } : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${cellPad} text-${col.align ?? 'left'}${col.align === 'right' ? ' tabular-nums' : ''}`}
                    style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--color-gray-100)' }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TableSkeleton<T>({ columns, rows }: { columns: TableColumn<T>[]; rows: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-[var(--radius-md)] animate-pulse"
          style={{ backgroundColor: 'var(--color-gray-100)' }}
        />
      ))}
      <span className="sr-only">Loading {columns.length} columns</span>
    </div>
  )
}
