/** JobEditPage — /jobs/:id/edit */

import { useParams, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useJob } from '../hooks/useJob'
import { useUpdateJob } from '../hooks/useUpdateJob'
import { JobForm } from '../components/JobForm'
import { JOB_ROUTES } from '../jobs.constants'
import type { CreateJobInput } from '../api/jobs.api.types'

function EditSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }} aria-busy="true" aria-label="Loading job">
      {[200, 120, 80, 300].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8, width: `${w}px`, maxWidth: '100%' }} aria-hidden="true" />
      ))}
    </div>
  )
}

export default function JobEditPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: job, status, refetch } = useJob(id)
  const { mutate, isPending } = useUpdateJob()

  const handleSubmit = (data: CreateJobInput) => {
    if (!job) return
    mutate(
      { id, data, title: job.title },
      { onSuccess: () => navigate(JOB_ROUTES.DETAIL(id)) },
    )
  }

  if (status === 'pending') return <AppShell><Header title="Edit Job" /><EditSkeleton /></AppShell>
  if (status === 'error' || !job) {
    return (
      <AppShell>
        <Header title="Edit Job" />
        <PageContainer>
          <ErrorState title="Could not load job" message="Check your connection and try again" onRetry={refetch} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title="Edit Job" />
      <PageContainer>
        <JobForm
          initialData={job}
          onSubmit={handleSubmit}
          isSubmitting={isPending}
          submitLabel="Save Changes"
        />
      </PageContainer>
    </AppShell>
  )
}
