/** PriceListCard — single row card in the list page */

import { Tag, Users, Star, Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PriceList } from '../price-list.types'

interface PriceListCardProps {
  priceList: PriceList
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

export function PriceListCard({ priceList, onClick, onEdit, onDelete }: PriceListCardProps) {
  const { t } = useLanguage()

  return (
    <div
      role="button"
      tabIndex={0}
      className={`pl-card${priceList.isDefault ? ' pl-card--default' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      aria-label={`${priceList.name}${priceList.isDefault ? ', default price list' : ''}`}
    >
      <div className="pl-card__header">
        <span className="pl-card__name">{priceList.name}</span>
        {priceList.isDefault && (
          <span className="pl-card__badge" aria-label="Default price list">
            <Star size={10} aria-hidden="true" />
            {t.plDefault}
          </span>
        )}
      </div>

      <div className="pl-card__meta">
        <span className="pl-card__meta-item">
          <Tag size={13} aria-hidden="true" />
          {priceList.entryCount} {t.plEntries}
        </span>
        <span className="pl-card__meta-item">
          <Users size={13} aria-hidden="true" />
          {priceList.partyCount} {t.plParties}
        </span>
      </div>

      <div className="pl-card__actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onEdit}
          aria-label={`Edit ${priceList.name}`}
        >
          <Pencil size={14} aria-hidden="true" />
          {t.edit}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-danger"
          onClick={onDelete}
          aria-label={`Delete ${priceList.name}`}
        >
          <Trash2 size={14} aria-hidden="true" />
          {t.delete}
        </button>
      </div>
    </div>
  )
}
