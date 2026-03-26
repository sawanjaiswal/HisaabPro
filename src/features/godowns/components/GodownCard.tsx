/** GodownCard — Single godown in the list */

import { Warehouse, MapPin } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { truncateAddress } from '../godown.utils'
import type { Godown } from '../godown.types'

interface GodownCardProps {
  godown: Godown
  onClick: (id: string) => void
}

export function GodownCard({ godown, onClick }: GodownCardProps) {
  const { t } = useLanguage()
  return (
    <button
      type="button"
      className="godown-card"
      onClick={() => onClick(godown.id)}
      aria-label={`${t.viewGodown} ${godown.name}`}
    >
      <div className="godown-card__icon">
        <Warehouse size={20} aria-hidden="true" />
      </div>

      <div className="godown-card__body">
        <div className="godown-card__header">
          <span className="godown-card__name">{godown.name}</span>
          {godown.isDefault && (
            <span className="godown-card__badge">{t.defaultBadge}</span>
          )}
        </div>
        {godown.address && (
          <div className="godown-card__address">
            <MapPin size={12} aria-hidden="true" />
            <span>{truncateAddress(godown.address)}</span>
          </div>
        )}
      </div>
    </button>
  )
}
