/** PriceListEntryRow — single entry in the entries table */

import { Pencil, Trash2 } from 'lucide-react'
import { formatPaise } from '@/lib/format'
import { MODE_LABELS, bpsToPercent, qtyBandLabel } from '../price-list.constants'
import type { PriceListEntry } from '../price-list.types'
import { Button } from '@/components/ui/Button'

interface PriceListEntryRowProps {
  entry: PriceListEntry
  onEdit: () => void
  onDelete: () => void
}

function entryValueLabel(entry: PriceListEntry): string {
  switch (entry.mode) {
    case 'ABSOLUTE':
      return entry.valuePaise !== null ? formatPaise(entry.valuePaise) : '—'
    case 'PERCENT_OFF':
      return entry.percentBps !== null ? `${bpsToPercent(entry.percentBps)}% off` : '—'
    case 'FIXED_OFF':
      return entry.fixedOffPaise !== null ? `${formatPaise(entry.fixedOffPaise)} off` : '—'
  }
}

export function PriceListEntryRow({ entry, onEdit, onDelete }: PriceListEntryRowProps) {
  return (
    <div className="pl-entry-row" role="row">
      <div className="pl-entry-row__info">
        <span className="pl-entry-row__product">{entry.productName}</span>
        <span className="pl-entry-row__detail">
          {MODE_LABELS[entry.mode]} &middot; Qty {qtyBandLabel(entry.minQty, entry.maxQty)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="pl-entry-row__value">{entryValueLabel(entry)}</span>
        <div className="pl-entry-row__actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label={`Edit entry for ${entry.productName}`}
          >
            <Pencil size={13} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            aria-label={`Delete entry for ${entry.productName}`}
          >
            <Trash2 size={13} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
