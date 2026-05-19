/**
 * Phase 7 Slice 7.1B FE.B1 — Mobile product row card.
 *
 * Renders a single preview row for a product import job in a stacked,
 * tap-friendly layout. Server delivers prices as JSON strings (BigInt
 * → String, SECURITY_AUDIT M5) and opening stock as a Decimal-as-string.
 *
 * Display rules:
 *  - Name bold, SKU secondary
 *  - Sale price formatted via formatCurrencyFromString (BigInt-safe)
 *  - MRP shown only when present and non-zero
 *  - Opening stock + unit on one line
 *  - GST rate shown as percent chip when known
 *  - Status badge reused from PreviewRowCard
 *  - Issues rendered as one-line summary via firstIssueMessage
 */

import { Card } from '@/components/ui/Card'
import {
  firstIssueMessage,
  readNormalizedGstRate,
  readNormalizedMrp,
  readNormalizedOpeningStock,
  readNormalizedProductName,
  readNormalizedSalePrice,
  readNormalizedSku,
  readNormalizedUnitText,
} from '../utils/preview-filters'
import { formatCurrencyFromString } from '../utils/format-currency-bigint'
import type { ImportPreviewRow } from '../types/import.types'
import { PreviewStatusBadge } from './PreviewRowCard'

interface ProductRowCardProps {
  row: ImportPreviewRow
  t: Record<string, string>
}

export function ProductRowCard({ row, t }: ProductRowCardProps) {
  const name = readNormalizedProductName(row) || (t.importPreviewMissingName ?? '—')
  const sku = readNormalizedSku(row)
  const salePrice = formatCurrencyFromString(readNormalizedSalePrice(row))
  const mrpRaw = readNormalizedMrp(row)
  const mrp = mrpRaw && mrpRaw !== '0' ? formatCurrencyFromString(mrpRaw) : null
  const openingStock = readNormalizedOpeningStock(row)
  const unitText = readNormalizedUnitText(row)
  const gstRate = readNormalizedGstRate(row)
  const issueMsg = firstIssueMessage(row.issues)

  return (
    <Card variant="default" className="p-4 space-y-2">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span
            className="font-semibold truncate"
            style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-primary)' }}
          >
            {name}
          </span>
          {sku && (
            <span
              className="truncate"
              style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}
            >
              {(t.productSku ?? 'SKU')}: {sku}
            </span>
          )}
        </div>
        <PreviewStatusBadge status={row.status} t={t} />
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
        <Stat
          label={t.productSalePrice ?? 'Sale price'}
          value={<span className="tabular-nums">{salePrice}</span>}
        />
        {mrp && (
          <Stat
            label={t.productMrp ?? 'MRP'}
            value={<span className="tabular-nums">{mrp}</span>}
          />
        )}
        <Stat
          label={t.productOpeningStock ?? 'Opening stock'}
          value={
            <span className="tabular-nums">
              {openingStock}
              {unitText ? ` ${unitText}` : ''}
            </span>
          }
        />
        {gstRate !== null && (
          <Stat
            label={t.productGstRate ?? 'GST'}
            value={<span className="tabular-nums">{gstRate}%</span>}
          />
        )}
      </dl>

      {issueMsg && (
        <p
          style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}
          className="truncate"
          title={issueMsg}
        >
          {issueMsg}
        </p>
      )}
    </Card>
  )
}

interface StatProps {
  label: string
  value: React.ReactNode
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="flex flex-col">
      <dt
        style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}
      >
        {label}
      </dt>
      <dd
        style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)' }}
      >
        {value}
      </dd>
    </div>
  )
}
