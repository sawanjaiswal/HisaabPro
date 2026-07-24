/** JobsEmptyState — empty UI state with CTA */

import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'

interface JobsEmptyStateProps {
  onCreateNew: () => void
}

export function JobsEmptyState({ onCreateNew }: JobsEmptyStateProps) {
  const { t } = useLanguage()
  return (
    <EmptyState
      icon={<Briefcase size={40} aria-hidden="true" />}
      title={t.jobsEmpty}
      description={t.jobsEmptyDesc}
      action={
        <Button
          type="button"
          variant="primary" size="md"
          onClick={onCreateNew}
          aria-label={t.jobCreateFirstAria}
        >
          {t.createJob}
        </Button>
      }
    />
  )
}
