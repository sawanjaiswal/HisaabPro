/** POS — Cart empty state */

import { ShoppingCart } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { EmptyState } from '@/components/feedback/EmptyState'

export function CartEmpty() {
  const { t } = useLanguage()
  return (
    <EmptyState
      icon={<ShoppingCart size={22} aria-hidden="true" strokeWidth={1.25} />}
      title={t.posCartEmptyTitle ?? 'Cart is empty'}
      description={t.posCartEmptyBody ?? 'Tap a product to add it to the cart'}
    />
  )
}
