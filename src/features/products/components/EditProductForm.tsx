/** Edit Product — Inner form (renders after data is loaded) */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useTaxCategories } from '@/hooks/useTaxCategories'
import { useProductForm } from '../useProductForm'
import { ProductFormBasic } from './ProductFormBasic'
import { ProductFormStock } from './ProductFormStock'
import { ProductFormExtra } from './ProductFormExtra'
import { PRODUCT_FORM_SECTIONS } from '../product.constants'
import { usePresence } from '@/features/collaboration/usePresence'
import { PresenceAvatars } from '@/features/collaboration/PresenceAvatars'
import { ConflictDialog } from '@/features/collaboration/ConflictDialog'
import type { ProductFormData } from '../product.types'
import '../create-product.css'

interface EditProductFormProps {
  productId: string
  initialData: ProductFormData
  version?: number
}

export function EditProductForm({ productId, initialData, version }: EditProductFormProps) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { categories: taxCategories } = useTaxCategories(businessId)
  const { form, errors, isSubmitting, activeSection, setActiveSection, updateField, handleSubmit, conflictReconcile } = useProductForm({ editId: productId, initialData, version })
  const { peers } = usePresence('product', productId, 'editing')

  return (
    <AppShell>
      <Header title={t.editProductTitle} backTo={`/products/${productId}`} actions={<PresenceAvatars peers={peers} />} />
      <PageContainer className="create-product-page space-y-6">
        <nav className="pill-tabs" role="tablist" aria-label={t.formSections}>
          {PRODUCT_FORM_SECTIONS.map((s) => (
            <Button variant="none" key={s.id} type="button" role="tab" className={`pill-tab${activeSection === s.id ? ' active' : ''}`} onClick={() => setActiveSection(s.id)} aria-selected={activeSection === s.id} aria-controls={`section-panel-${s.id}`}>
              {s.label}
            </Button>
          ))}
        </nav>
        <div id={`section-panel-${activeSection}`} role="tabpanel" aria-label={PRODUCT_FORM_SECTIONS.find((s) => s.id === activeSection)?.label}>
          {activeSection === 'basic' && <ProductFormBasic form={form} errors={errors} onUpdate={updateField} />}
          {activeSection === 'stock' && <ProductFormStock form={form} errors={errors} onUpdate={updateField} />}
          {activeSection === 'extra' && <ProductFormExtra form={form} errors={errors} onUpdate={updateField} taxCategories={taxCategories} />}
        </div>
      </PageContainer>
      <div className="create-product-actions">
        <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit} aria-label={t.updateProductLabel}>{t.updateProductBtn}</Button>
      </div>

      <ConflictDialog
        conflict={conflictReconcile.conflict}
        overwriting={conflictReconcile.overwriting}
        onReload={conflictReconcile.reload}
        onOverwrite={conflictReconcile.overwrite}
        onDismiss={conflictReconcile.dismiss}
      />
    </AppShell>
  )
}
