/** Edit Product — Inner form (renders after data is loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useTaxCategories } from '@/hooks/useTaxCategories'
import { useProductForm } from '../useProductForm'
import { ProductFormBasic } from './ProductFormBasic'
import { ProductFormStock } from './ProductFormStock'
import { ProductFormExtra } from './ProductFormExtra'
import { PRODUCT_FORM_SECTIONS } from '../product.constants'
import type { ProductFormData } from '../product.types'
import '../create-product.css'

interface EditProductFormProps {
  productId: string
  initialData: ProductFormData
}

export function EditProductForm({ productId, initialData }: EditProductFormProps) {
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { categories: taxCategories } = useTaxCategories(businessId)
  const { form, errors, isSubmitting, activeSection, setActiveSection, updateField, handleSubmit } = useProductForm({ editId: productId, initialData })

  return (
    <AppShell>
      <Header title="Edit Product" backTo={`/products/${productId}`} />
      <PageContainer className="create-product-page">
        <nav className="pill-tabs" role="tablist" aria-label="Form sections">
          {PRODUCT_FORM_SECTIONS.map((s) => (
            <button key={s.id} type="button" role="tab" className={`pill-tab${activeSection === s.id ? ' active' : ''}`} onClick={() => setActiveSection(s.id)} aria-selected={activeSection === s.id} aria-controls={`section-panel-${s.id}`}>
              {s.label}
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
        <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit} aria-label="Update product">Update Product</Button>
      </div>
    </AppShell>
  )
}
