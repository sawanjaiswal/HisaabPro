/** CustomOrdersErrorState — error UI state with retry */

import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/context/LanguageContext'

interface CustomOrdersErrorStateProps {
  onRetry: () => void
}

export function CustomOrdersErrorState({ onRetry }: CustomOrdersErrorStateProps) {
  const { t } = useLanguage()
  return (
    <ErrorState
      title={t.coLoadOrdersError}
      message={t.coConnectionRetry}
      onRetry={onRetry}
    />
  )
}
