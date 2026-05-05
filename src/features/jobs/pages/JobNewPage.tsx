/** JobNewPage — /jobs/new */

import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useCreateJob } from '../hooks/useCreateJob'
import { JobForm } from '../components/JobForm'
import { JOB_ROUTES } from '../jobs.constants'
import type { CreateJobInput } from '../api/jobs.api.types'

export default function JobNewPage() {
  const navigate = useNavigate()
  const { mutate, isPending } = useCreateJob()

  const handleSubmit = (data: CreateJobInput) => {
    mutate(data, {
      onSuccess: (result) => {
        if (result?.id) {
          navigate(JOB_ROUTES.DETAIL(result.id))
        } else {
          navigate(JOB_ROUTES.LIST)
        }
      },
    })
  }

  return (
    <AppShell>
      <Header title="New Job" />
      <PageContainer>
        <JobForm
          onSubmit={handleSubmit}
          isSubmitting={isPending}
          submitLabel="Create Job"
        />
      </PageContainer>
    </AppShell>
  )
}
