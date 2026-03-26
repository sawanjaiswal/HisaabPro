/** Edit Godown — Page (lazy loaded)
 *
 * Fetches existing godown data, then reuses GodownForm + useGodownForm in edit mode.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { api } from '@/lib/api'
import { useGodownForm } from './useGodownForm'
import { GodownForm } from './components/GodownForm'
import type { Godown, CreateGodownData } from './godown.types'
import './godowns.css'

export default function EditGodownPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const godownId = id ?? ''

  const [loadStatus, setLoadStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [initialData, setInitialData] = useState<CreateGodownData | undefined>()

  useEffect(() => {
    if (!godownId) {
      setLoadStatus('error')
      return
    }

    const controller = new AbortController()
    setLoadStatus('loading')

    api<Godown>(`/godowns/${godownId}`, { signal: controller.signal })
      .then((godown) => {
        setInitialData({
          name: godown.name,
          address: godown.address ?? '',
          isDefault: godown.isDefault,
        })
        setLoadStatus('ready')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setLoadStatus('error')
      })

    return () => controller.abort()
  }, [godownId])

  const backTo = ROUTES.GODOWN_DETAIL.replace(':id', godownId)

  if (loadStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.editGodown} backTo={backTo} />
        <PageContainer>
          <Skeleton height="3.5rem" borderRadius="var(--radius-md)" count={3} />
        </PageContainer>
      </AppShell>
    )
  }

  if (loadStatus === 'error' || !initialData) {
    return (
      <AppShell>
        <Header title={t.editGodown} backTo={backTo} />
        <PageContainer>
          <ErrorState
            title={t.couldNotLoadGodown}
            message={t.checkConnectionRetry}
            onRetry={() => window.location.reload()}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return <EditGodownForm godownId={godownId} initialData={initialData} backTo={backTo} />
}

function EditGodownForm({ godownId, initialData, backTo }: { godownId: string; initialData: CreateGodownData; backTo: string }) {
  const { t } = useLanguage()
  const { form, errors, isSubmitting, updateField, handleSubmit } = useGodownForm({
    editId: godownId,
    initialData,
  })

  return (
    <AppShell>
      <Header title={t.editGodown} backTo={backTo} />
      <PageContainer>
        <GodownForm
          form={form}
          errors={errors}
          isSubmitting={isSubmitting}
          onUpdate={updateField}
          onSubmit={handleSubmit}
          submitLabel={t.updateGodown}
        />
      </PageContainer>
    </AppShell>
  )
}
