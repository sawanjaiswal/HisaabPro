/** PriceListEmpty — empty-state for the list page */

import { Text } from '@/components/ui/Text'
import { Tag, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface PriceListEmptyProps {
  onAdd: () => void
}

export function PriceListEmpty({ onAdd }: PriceListEmptyProps) {
  const { t } = useLanguage()
  return (
    <div className="pl-empty" role="status" aria-live="polite">
      <Tag size={40} className="pl-empty__icon" aria-hidden="true" />
      <Text className="pl-empty__title">{t.plEmptyTitle}</Text>
      <Text className="pl-empty__body">{t.plEmptyDesc}</Text>
      <Button type="button" variant="primary" onClick={onAdd}>
        <Plus size={16} aria-hidden="true" />
        {t.plCreate}
      </Button>
    </div>
  )
}
