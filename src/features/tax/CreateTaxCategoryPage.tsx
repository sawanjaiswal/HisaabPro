/** Tax — Create Tax Category page (lazy loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { FALLBACK_BUSINESS_ID } from '@/config/app.config'
import { useAuth } from '@/context/AuthContext'
import { useTaxCategoryForm } from './useTaxCategoryForm'
import { TaxCategoryFormFields } from './components/TaxCategoryFormFields'
import './tax-category-form.css'

export default function CreateTaxCategoryPage() {
  const { user } = useAuth()
  const businessId = user?.businessId ?? FALLBACK_BUSINESS_ID
  const { form, errors, isSubmitting, updateField, handleSubmit } = useTaxCategoryForm({ businessId })

  return (
    <AppShell>
      <Header title="New Tax Rate" backTo={ROUTES.SETTINGS_TAX_RATES} />
      <PageContainer className="tax-category-form-page">
        <TaxCategoryFormFields form={form} errors={errors} onUpdate={updateField} />
      </PageContainer>
      <div className="tax-category-form-actions">
        <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit} aria-label="Save tax rate">
          Save Tax Rate
        </Button>
      </div>
    </AppShell>
  )
}
