/** JobsEmptyState — empty UI state with CTA */

import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/feedback/EmptyState'

interface JobsEmptyStateProps {
  onCreateNew: () => void
}

export function JobsEmptyState({ onCreateNew }: JobsEmptyStateProps) {
  return (
    <EmptyState
      icon={<Briefcase size={40} aria-hidden="true" />}
      title="No jobs yet"
      description="Create your first job to start tracking work orders and convert them to invoices"
      action={
        <Button
          type="button"
          variant="primary" size="md"
          onClick={onCreateNew}
          aria-label="Create first job"
        >
          Create Job
        </Button>
      }
    />
  )
}
