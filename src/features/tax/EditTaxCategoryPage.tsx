/** Tax — Edit Tax Category page (lazy loaded) */

import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useTaxCategoryDetail } from './useTaxCategoryDetail'
import { useTaxCategoryForm } from './useTaxCategoryForm'
import { TaxCategoryFormFields } from './components/TaxCategoryFormFields'
import './tax-category-form.css'

export default function EditTaxCategoryPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { category, status, refresh } = useTaxCategoryDetail(id)

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title={t.editTaxRate} backTo={ROUTES.SETTINGS_TAX_RATES} />
        <PageContainer className="tax-category-form-page">
          <Skeleton width="100%" height="300px" borderRadius="var(--radius-lg)" />
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error' || !category) {
    return (
      <AppShell>
        <Header title={t.editTaxRate} backTo={ROUTES.SETTINGS_TAX_RATES} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadTaxCategory} message={t.checkConnectionRetry} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return <EditForm editId={id} businessId={businessId} initialData={{
    name: category.name, rate: category.rate, cessRate: category.cessRate,
    cessType: category.cessType, hsnCode: category.hsnCode ?? '', sacCode: category.sacCode ?? '',
  }} />
}

function EditForm({ editId, businessId, initialData }: { editId: string; businessId: string; initialData: import('./tax.types').TaxCategoryFormData }) {
  const { t } = useLanguage()
  const { form, errors, isSubmitting, updateField, handleSubmit } = useTaxCategoryForm({ editId, initialData, businessId })

  return (
    <AppShell>
      <Header title={t.editTaxRate} backTo={ROUTES.SETTINGS_TAX_RATES} />
      <PageContainer className="tax-category-form-page">
        <TaxCategoryFormFields form={form} errors={errors} onUpdate={updateField} />
      </PageContainer>
      <div className="tax-category-form-actions">
        <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit} aria-label={t.updateTaxRate}>
          {t.updateTaxRate}
        </Button>
      </div>
    </AppShell>
  )
}
