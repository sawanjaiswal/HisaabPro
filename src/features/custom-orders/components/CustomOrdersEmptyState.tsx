/** CustomOrdersEmptyState — empty UI state with CTA */

import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/context/LanguageContext'

interface CustomOrdersEmptyStateProps {
  onCreateNew: () => void
}

export function CustomOrdersEmptyState({ onCreateNew }: CustomOrdersEmptyStateProps) {
  const { t } = useLanguage()
  return (
    <EmptyState
      icon={<ShoppingBag size={40} aria-hidden="true" />}
      title={t.coEmptyTitle}
      description={t.coEmptyDesc}
      action={
        <Button
          type="button"
          variant="primary" size="md"
          onClick={onCreateNew}
          aria-label={t.coCreateFirstAria}
        >
          {t.coCreateOrder}
        </Button>
      }
    />
  )
}
