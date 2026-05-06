/** JobNewPage — /jobs/new */

import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useCreateJob } from '../hooks/useCreateJob'
import { JobForm } from '../components/JobForm'
import { JOB_ROUTES } from '../jobs.constants'
import type { CreateJobInput } from '../api/jobs.api.types'

export default function JobNewPage() {
  const navigate = useNavigate()
  const { mutate, isPending } = useCreateJob()
  const toast = useToast()
  const { t } = useLanguage()

  const handleSubmit = (data: CreateJobInput) => {
    // Attach a client-generated idempotency key so the server can de-duplicate
    // retried offline requests by Job.clientId.
    const clientId = crypto.randomUUID()
    mutate({ ...data, clientId }, {
      onSuccess: (result) => {
        if (result?.id) {
          navigate(JOB_ROUTES.DETAIL(result.id))
        } else {
          // Offline path — api() returns {} so result.id is undefined.
          toast.success(t.jobSavedOffline)
          navigate(JOB_ROUTES.LIST)
        }
      },
    })
  }

  return (
    <AppShell>
      <Header title={t.newJob} />
      <PageContainer>
        <JobForm
          onSubmit={handleSubmit}
          isSubmitting={isPending}
          submitLabel={t.createJob}
        />
      </PageContainer>
    </AppShell>
  )
}
