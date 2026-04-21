/** Tax — Create Tax Category page (lazy loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useTaxCategoryForm } from './useTaxCategoryForm'
import { TaxCategoryFormFields } from './components/TaxCategoryFormFields'
import './tax-category-form.css'

export default function CreateTaxCategoryPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { form, errors, isSubmitting, updateField, handleSubmit } = useTaxCategoryForm({ businessId })

  return (
    <AppShell>
      <Header title={t.newTaxRate} backTo={ROUTES.SETTINGS_TAX_RATES} />
      <PageContainer className="tax-category-form-page space-y-6">
        <TaxCategoryFormFields form={form} errors={errors} onUpdate={updateField} />
      </PageContainer>
      <div className="tax-category-form-actions">
        <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit} aria-label={t.saveTaxRate}>
          {t.saveTaxRate}
        </Button>
      </div>
    </AppShell>
  )
}
