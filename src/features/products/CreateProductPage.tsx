/** Create Product — Page (lazy loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useProductForm } from './useProductForm'
import { ProductFormBasic } from './components/ProductFormBasic'
import { ProductFormStock } from './components/ProductFormStock'
import { ProductFormExtra } from './components/ProductFormExtra'
import './create-product.css'

type SectionId = 'basic' | 'stock' | 'extra'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'stock', label: 'Stock' },
  { id: 'extra', label: 'Extra' },
]

export default function CreateProductPage() {
  const {
    form,
    errors,
    isSubmitting,
    activeSection,
    setActiveSection,
    updateField,
    handleSubmit,
    reset,
  } = useProductForm()

  const handleSaveAndAddAnother = async () => {
    await handleSubmit()
    reset()
    setActiveSection('basic')
  }

  return (
    <AppShell>
      <Header title="New Product" backTo={ROUTES.PRODUCTS} />

      <PageContainer className="create-product-page">
        <nav className="pill-tabs" role="tablist" aria-label="Form sections">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              className={`pill-tab${activeSection === section.id ? ' active' : ''}`}
              onClick={() => setActiveSection(section.id)}
              aria-selected={activeSection === section.id}
              aria-controls={`section-panel-${section.id}`}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div
          id={`section-panel-${activeSection}`}
          role="tabpanel"
          aria-label={SECTIONS.find((s) => s.id === activeSection)?.label}
        >
          {activeSection === 'basic' && (
            <ProductFormBasic form={form} errors={errors} onUpdate={updateField} />
          )}
          {activeSection === 'stock' && (
            <ProductFormStock form={form} errors={errors} onUpdate={updateField} />
          )}
          {activeSection === 'extra' && (
            <ProductFormExtra form={form} errors={errors} onUpdate={updateField} />
          )}
        </div>
      </PageContainer>

      <div className="create-product-actions">
        <Button
          variant="primary"
          size="lg"
          loading={isSubmitting}
          onClick={handleSubmit}
          aria-label="Save product"
        >
          Save Product
        </Button>
        <button
          type="button"
          className="create-product-save-another"
          onClick={handleSaveAndAddAnother}
          disabled={isSubmitting}
          aria-label="Save product and add another"
        >
          Save &amp; Add Another
        </button>
      </div>
    </AppShell>
  )
}
