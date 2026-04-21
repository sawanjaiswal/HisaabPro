/** Create Godown — Page (lazy loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useGodownForm } from './useGodownForm'
import { GodownForm } from './components/GodownForm'
import './godowns.css'

export default function CreateGodownPage() {
  const { t } = useLanguage()
  const { form, errors, isSubmitting, updateField, handleSubmit } = useGodownForm()

  return (
    <AppShell>
      <Header title={t.newGodown} backTo={ROUTES.GODOWNS} />
      <PageContainer className="stagger-enter space-y-6">
        <GodownForm
          form={form}
          errors={errors}
          isSubmitting={isSubmitting}
          onUpdate={updateField}
          onSubmit={handleSubmit}
          submitLabel={t.createGodown}
        />
      </PageContainer>
    </AppShell>
  )
}
