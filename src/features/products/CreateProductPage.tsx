/** Create Product — Page (lazy loaded) */

import { FormPageShell } from '@/components/layout/FormPageShell'
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

  const sectionIds = PRODUCT_FORM_SECTIONS.map((s) => s.id)
  const sectionIndex = sectionIds.indexOf(activeSection)
  const isLastSection = sectionIndex === sectionIds.length - 1

  const handleSaveAndAddAnother = async () => { await handleSubmit(); reset(); setActiveSection('basic') }
  const handleNext = () => setActiveSection(sectionIds[sectionIndex + 1])

  return (
    <FormPageShell
      title={t.newProduct}
      backTo={ROUTES.PRODUCTS}
      onSubmit={(e) => {
        e.preventDefault()
        if (isLastSection) handleSubmit()
        else handleNext()
      }}
      footer={
        isLastSection ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAndAddAnother}
              disabled={isSubmitting}
              aria-label={t.saveAndAddAnotherProduct}
            >
              {t.saveAndAddAnother}
            </Button>
            <Button
              variant="primary"
              size="lg"
              loading={isSubmitting}
              onClick={handleSubmit}
              aria-label={t.saveProduct}
            >
              {t.saveProductBtn}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            type="button"
            onClick={handleNext}
            aria-label={t.next}
          >
            {t.next}
          </Button>
        )
      }
    >
      <nav className="pill-tabs" role="tablist" aria-label={t.formSections}>
        {PRODUCT_FORM_SECTIONS.map((section) => (
          <Button
            variant="none"
            key={section.id}
            type="button"
            role="tab"
            className={`pill-tab${activeSection === section.id ? ' active' : ''}`}
            onClick={() => setActiveSection(section.id)}
            aria-selected={activeSection === section.id}
            aria-controls={`section-panel-${section.id}`}
          >
            {section.label}
          </Button>
        ))}
      </nav>
      <div id={`section-panel-${activeSection}`} role="tabpanel" aria-label={PRODUCT_FORM_SECTIONS.find((s) => s.id === activeSection)?.label}>
        {activeSection === 'basic' && <ProductFormBasic form={form} errors={errors} onUpdate={updateField} />}
        {activeSection === 'stock' && <ProductFormStock form={form} errors={errors} onUpdate={updateField} />}
        {activeSection === 'extra' && <ProductFormExtra form={form} errors={errors} onUpdate={updateField} taxCategories={taxCategories} />}
      </div>
    </FormPageShell>
  )
}
