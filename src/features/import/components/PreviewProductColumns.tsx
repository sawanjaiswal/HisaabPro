/**
 * Phase 7 Slice 7.1B FE.B1 — Product column set for <PreviewTable>.
 *
 * Extracted so PreviewTable.tsx stays under 250L while supporting both
 * entities. Columns are paste-compatible with `<ResponsiveTable>` —
 * same `TableColumn<ImportPreviewRow>` shape used by the party set.
 */

import type { TableColumn } from '@/components/layout/ResponsiveTable'
import {
  firstIssueMessage,
  readNormalizedOpeningStock,
  readNormalizedProductName,
  readNormalizedSalePrice,
  readNormalizedSku,
  readNormalizedUnitText,
} from '../utils/preview-filters'
import { formatCurrencyFromString } from '../utils/format-currency-bigint'
import type { ImportPreviewRow } from '../types/import.types'
import { PreviewStatusBadge } from './PreviewRowCard'

export function buildProductColumns(
  t: Record<string, string>,
): TableColumn<ImportPreviewRow>[] {
  return [
    {
      key: 'sourceIndex',
      header: t.importPreviewColRow ?? 'Row',
      width: 'w-16',
      align: 'left',
      render: (r) => <span className="tabular-nums">{r.sourceIndex + 1}</span>,
    },
    {
      key: 'name',
      header: t.productName ?? 'Name',
      render: (r) => (
        <span className="truncate inline-block max-w-[180px] align-bottom">
          {readNormalizedProductName(r) || (t.importPreviewMissingName ?? '—')}
        </span>
      ),
    },
    {
      key: 'sku',
      header: t.productSku ?? 'SKU',
      render: (r) => {
        const sku = readNormalizedSku(r)
        return sku ? (
          <span className="truncate inline-block max-w-[120px] align-bottom">{sku}</span>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
        )
      },
    },
    {
      key: 'salePrice',
      header: t.productSalePrice ?? 'Sale price',
      align: 'right',
      render: (r) => (
        <span className="tabular-nums">
          {formatCurrencyFromString(readNormalizedSalePrice(r))}
        </span>
      ),
    },
    {
      key: 'openingStock',
      header: t.productOpeningStock ?? 'Stock',
      align: 'right',
      render: (r) => {
        const unit = readNormalizedUnitText(r)
        return (
          <span className="tabular-nums">
            {readNormalizedOpeningStock(r)}
            {unit ? ` ${unit}` : ''}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: t.importPreviewColStatus ?? 'Status',
      render: (r) => <PreviewStatusBadge status={r.status} t={t} />,
    },
    {
      key: 'reason',
      header: t.importPreviewColReason ?? 'Reason',
      render: (r) => {
        const msg = firstIssueMessage(r.issues)
        if (!msg) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
        return (
          <span
            style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)' }}
            className="truncate inline-block max-w-[200px] align-bottom"
            title={msg}
          >
            {msg}
          </span>
        )
      },
    },
  ]
}
