/** CustomOrdersEmptyState — empty UI state with CTA */

import { ShoppingBag } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'

interface CustomOrdersEmptyStateProps {
  onCreateNew: () => void
}

export function CustomOrdersEmptyState({ onCreateNew }: CustomOrdersEmptyStateProps) {
  return (
    <EmptyState
      icon={<ShoppingBag size={40} aria-hidden="true" />}
      title="No orders yet"
      description="Create your first custom order to start tracking bakery or tailor orders"
      action={
        <button
          type="button"
          className="btn btn-primary btn-md"
          onClick={onCreateNew}
          aria-label="Create first order"
        >
          Create Order
        </button>
      }
    />
  )
}
