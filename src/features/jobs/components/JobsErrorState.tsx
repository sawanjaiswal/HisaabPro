/** JobsErrorState — error UI state with retry */

import { ErrorState } from '@/components/feedback/ErrorState'

interface JobsErrorStateProps {
  onRetry: () => void
}

export function JobsErrorState({ onRetry }: JobsErrorStateProps) {
  return (
    <ErrorState
      title="Could not load jobs"
      message="Check your connection and try again"
      onRetry={onRetry}
    />
  )
}
