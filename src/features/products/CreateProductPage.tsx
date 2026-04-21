/** Create Product — Page (lazy loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useProductForm } from './useProductForm'
import { useTaxCategories } from '@/hooks/useTaxCategories'
import { ProductFormBasic } from './components/ProductFormBasic'
import { ProductFormStock } from './components/ProductFormStock'
import { ProductFormExtra } from './components/ProductFormExtra'
import { PRODUCT_FORM_SECTIONS } from './product.constants'
import './create-product.css'

export default function CreateProductPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { categories: taxCategories } = useTaxCategories(businessId)
  const { form, errors, isSubmitting, activeSection, setActiveSection, updateField, handleSubmit, reset } = useProductForm()

  const handleSaveAndAddAnother = async () => { await handleSubmit(); reset(); setActiveSection('basic') }

  return (
    <AppShell>
      <Header title={t.newProduct} backTo={ROUTES.PRODUCTS} />
      <PageContainer className="create-product-page stagger-enter space-y-6">
        <nav className="pill-tabs" role="tablist" aria-label={t.formSections}>
          {PRODUCT_FORM_SECTIONS.map((section) => (
            <button key={section.id} type="button" role="tab" className={`pill-tab${activeSection === section.id ? ' active' : ''}`} onClick={() => setActiveSection(section.id)} aria-selected={activeSection === section.id} aria-controls={`section-panel-${section.id}`}>
              {section.label}
            </button>
          ))}
        </nav>
        <div id={`section-panel-${activeSection}`} role="tabpanel" aria-label={PRODUCT_FORM_SECTIONS.find((s) => s.id === activeSection)?.label}>
          {activeSection === 'basic' && <ProductFormBasic form={form} errors={errors} onUpdate={updateField} />}
          {activeSection === 'stock' && <ProductFormStock form={form} errors={errors} onUpdate={updateField} />}
          {activeSection === 'extra' && <ProductFormExtra form={form} errors={errors} onUpdate={updateField} taxCategories={taxCategories} />}
        </div>
      </PageContainer>
      <div className="create-product-actions">
        <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit} aria-label={t.saveProduct}>{t.saveProductBtn}</Button>
        <button type="button" className="create-product-save-another" onClick={handleSaveAndAddAnother} disabled={isSubmitting} aria-label={t.saveAndAddAnotherProduct}>{t.saveAndAddAnother}</button>
      </div>
    </AppShell>
  )
}
