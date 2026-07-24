/** JobsErrorState — error UI state with retry */

import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'

interface JobsErrorStateProps {
  onRetry: () => void
}

export function JobsErrorState({ onRetry }: JobsErrorStateProps) {
  const { t } = useLanguage()
  return (
    <ErrorState
      title={t.jobsLoadError}
      message={t.jobsCheckConnection}
      onRetry={onRetry}
    />
  )
}
