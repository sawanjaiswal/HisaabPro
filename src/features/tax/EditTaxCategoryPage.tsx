/** Tax — Edit Tax Category page (lazy loaded) */

import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { FALLBACK_BUSINESS_ID } from '@/config/app.config'
import { useAuth } from '@/context/AuthContext'
import { useTaxCategoryDetail } from './useTaxCategoryDetail'
import { useTaxCategoryForm } from './useTaxCategoryForm'
import { TaxCategoryFormFields } from './components/TaxCategoryFormFields'
import './tax-category-form.css'

export default function EditTaxCategoryPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const businessId = user?.businessId ?? FALLBACK_BUSINESS_ID
  const { category, status, refresh } = useTaxCategoryDetail(id!)

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title="Edit Tax Rate" backTo={ROUTES.SETTINGS_TAX_RATES} />
        <PageContainer className="tax-category-form-page">
          <Skeleton width="100%" height="300px" borderRadius="var(--radius-lg)" />
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error' || !category) {
    return (
      <AppShell>
        <Header title="Edit Tax Rate" backTo={ROUTES.SETTINGS_TAX_RATES} />
        <PageContainer>
          <ErrorState title="Could not load tax category" message="Check your connection and try again." onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return <EditForm editId={id!} businessId={businessId} initialData={{
    name: category.name, rate: category.rate, cessRate: category.cessRate,
    cessType: category.cessType, hsnCode: category.hsnCode ?? '', sacCode: category.sacCode ?? '',
  }} />
}

function EditForm({ editId, businessId, initialData }: { editId: string; businessId: string; initialData: import('./tax.types').TaxCategoryFormData }) {
  const { form, errors, isSubmitting, updateField, handleSubmit } = useTaxCategoryForm({ editId, initialData, businessId })

  return (
    <AppShell>
      <Header title="Edit Tax Rate" backTo={ROUTES.SETTINGS_TAX_RATES} />
      <PageContainer className="tax-category-form-page">
        <TaxCategoryFormFields form={form} errors={errors} onUpdate={updateField} />
      </PageContainer>
      <div className="tax-category-form-actions">
        <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit} aria-label="Update tax rate">
          Update Tax Rate
        </Button>
      </div>
    </AppShell>
  )
}
