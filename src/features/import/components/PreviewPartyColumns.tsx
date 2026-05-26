/**
 * Phase 7 Slice 7.1A — Party column set for <PreviewTable>.
 *
 * Extracted in 7.1B so PreviewTable can host both party + product
 * column dictionaries without breaking the ≤250L file cap.
 */

import type { TableColumn } from '@/components/layout/ResponsiveTable'
import { formatPaise } from '@/lib/format'
import {
  firstIssueMessage,
  readNormalizedBalancePaise,
  readNormalizedName,
  readNormalizedPhone,
} from '../utils/preview-filters'
import type { ImportPreviewRow } from '../types/import.types'
import { PreviewStatusBadge } from './PreviewRowCard'

export function buildPartyColumns(
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
      header: t.importPreviewColName ?? 'Name',
      render: (r) => (
        <span className="truncate inline-block max-w-[180px] align-bottom">
          {readNormalizedName(r) || (t.importPreviewMissingName ?? '—')}
        </span>
      ),
    },
    {
      key: 'phone',
      header: t.importPreviewColPhone ?? 'Phone',
      render: (r) => readNormalizedPhone(r) || (t.importPreviewMissingPhone ?? '—'),
    },
    {
      key: 'balance',
      header: t.importPreviewColBalance ?? 'Balance',
      align: 'right',
      render: (r) => (
        <span className="tabular-nums">{formatPaise(readNormalizedBalancePaise(r))}</span>
      ),
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
            className="truncate inline-block max-w-[220px] align-bottom"
            title={msg}
          >
            {msg}
          </span>
        )
      },
    },
  ]
}
