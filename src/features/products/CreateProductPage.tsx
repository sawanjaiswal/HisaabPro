/** Create Product — Page (lazy loaded) */

import { FormPageShell } from '@/components/layout/FormPageShell'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
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
  const { form, errors, isSubmitting, isEditMode, activeSection, setActiveSection, updateField, handleSubmit, reset } = useProductForm()

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
      <Tabs
        value={activeSection}
        onValueChange={(val) => setActiveSection(val as 'basic' | 'stock' | 'extra')}
        className="w-full"
      >
        <TabsList variant="line" aria-label={t.formSections} className="mb-4">
          {PRODUCT_FORM_SECTIONS.map((section) => (
            <TabsTrigger key={section.id} value={section.id}>
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="basic">
          <ProductFormBasic form={form} errors={errors} onUpdate={updateField} />
        </TabsContent>
        <TabsContent value="stock">
          <ProductFormStock form={form} errors={errors} onUpdate={updateField} isEditMode={isEditMode} />
        </TabsContent>
        <TabsContent value="extra">
          <ProductFormExtra form={form} errors={errors} onUpdate={updateField} taxCategories={taxCategories} />
        </TabsContent>
      </Tabs>
    </FormPageShell>
  )
}
