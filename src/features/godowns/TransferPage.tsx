/** Transfer Stock — Page (lazy loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useApi } from '@/hooks/useApi'
import { useTransferForm } from './useTransferForm'
import { TransferForm } from './components/TransferForm'
import type { GodownListResponse } from './godown.types'
import './godowns.css'

export default function TransferPage() {
  const { t } = useLanguage()
  const { form, errors, isSubmitting, updateField, handleSubmit } = useTransferForm()
  const { data, status, error, refetch } = useApi<GodownListResponse>('/godowns?limit=200&isDeleted=false')

  return (
    <AppShell>
      <Header title={t.transferStock} backTo={ROUTES.GODOWNS} />
      <PageContainer>
        {status === 'loading' && <Skeleton height="4rem" count={5} />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadGodowns}
            message={error?.message ?? t.godownListNeeded}
            onRetry={refetch}
          />
        )}

        {status === 'success' && data && (
          <TransferForm
            form={form}
            errors={errors}
            isSubmitting={isSubmitting}
            godowns={data.godowns}
            onUpdate={updateField}
            onSubmit={handleSubmit}
          />
        )}
      </PageContainer>
    </AppShell>
  )
}
