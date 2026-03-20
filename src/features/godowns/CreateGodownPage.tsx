/** Create Godown — Page (lazy loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useGodownForm } from './useGodownForm'
import { GodownForm } from './components/GodownForm'
import './godowns.css'

export default function CreateGodownPage() {
  const { form, errors, isSubmitting, updateField, handleSubmit } = useGodownForm()

  return (
    <AppShell>
      <Header title="New Godown" backTo={ROUTES.GODOWNS} />
      <PageContainer>
        <GodownForm
          form={form}
          errors={errors}
          isSubmitting={isSubmitting}
          onUpdate={updateField}
          onSubmit={handleSubmit}
          submitLabel="Create Godown"
        />
      </PageContainer>
    </AppShell>
  )
}
