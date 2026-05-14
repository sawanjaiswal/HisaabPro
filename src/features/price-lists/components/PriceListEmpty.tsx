/** PriceListEmpty — empty-state for the list page */

import { Tag, Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface PriceListEmptyProps {
  onAdd: () => void
}

export function PriceListEmpty({ onAdd }: PriceListEmptyProps) {
  const { t } = useLanguage()
  return (
    <div className="pl-empty" role="status" aria-live="polite">
      <Tag size={40} className="pl-empty__icon" aria-hidden="true" />
      <p className="pl-empty__title">{t.plEmptyTitle}</p>
      <p className="pl-empty__body">{t.plEmptyDesc}</p>
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Plus size={16} aria-hidden="true" />
        {t.plCreate}
      </button>
    </div>
  )
}
