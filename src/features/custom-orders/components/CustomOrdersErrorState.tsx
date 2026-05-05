/** CustomOrdersErrorState — error UI state with retry */

import { ErrorState } from '@/components/feedback/ErrorState'

interface CustomOrdersErrorStateProps {
  onRetry: () => void
}

export function CustomOrdersErrorState({ onRetry }: CustomOrdersErrorStateProps) {
  return (
    <ErrorState
      title="Could not load orders"
      message="Check your connection and try again"
      onRetry={onRetry}
    />
  )
}
