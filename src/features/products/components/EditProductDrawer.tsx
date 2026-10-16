/** Edit Product — Drawer sub-flow (Radix Drawer / bottom sheet)
 *
 * Conforms to AGENTS.md Axiom 1.1: sub-creations/edits run in a TaskFrame
 * so the caller form (e.g. Invoice draft) is never unmounted and state is preserved.
 */

import { useState, useEffect, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useTaxCategories } from '@/hooks/useTaxCategories'
import { getProduct } from '../product.service'
import { useProductForm } from '../useProductForm'
import { ProductFormBasic } from './ProductFormBasic'
import { ProductFormStock } from './ProductFormStock'
import { ProductFormExtra } from './ProductFormExtra'
import { PRODUCT_FORM_SECTIONS } from '../product.constants'
import { ConflictDialog } from '@/features/collaboration/ConflictDialog'
import type { ProductDetail, ProductFormData } from '../product.types'

export interface EditProductDrawerProps {
  productId: string | null
  open: boolean
  onClose: () => void
  onProductUpdated?: (updated: { id: string; name: string; salePrice: number }) => void
}

function detailToFormData(detail: ProductDetail): ProductFormData {
  return {
    name: detail.name,
    sku: detail.sku,
    autoGenerateSku: false,
    categoryId: detail.category?.id ?? null,
    unitId: detail.unit?.id ?? '',
    salePrice: detail.salePrice,
    purchasePrice: detail.purchasePrice ?? 0,
    openingStock: detail.currentStock ?? 0,
    minStockLevel: detail.minStockLevel ?? 0,
    stockValidation: detail.stockValidation ?? 'GLOBAL',
    barcode: detail.barcode ?? undefined,
    barcodeFormat: detail.barcodeFormat ?? undefined,
    hsnCode: detail.hsnCode ?? '',
    sacCode: detail.sacCode ?? undefined,
    taxCategoryId: detail.taxCategory?.id ?? null,
    description: detail.description ?? '',
    status: detail.status ?? 'ACTIVE',
  }
}

export function EditProductDrawer({
  productId,
  open,
  onClose,
  onProductUpdated,
}: EditProductDrawerProps) {
  const { t } = useLanguage()
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !productId) {
      setDetail(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    getProduct(productId, controller.signal)
      .then((d) => {
        setDetail(d)
        setLoading(false)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setLoading(false)
      })
    return () => controller.abort()
  }, [open, productId])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.editProductTitle || 'Edit Product'}
      size="lg"
    >
      {loading || !detail || !productId ? (
        <div className="p-4 space-y-4">
          <Skeleton height="2.5rem" borderRadius="var(--radius-md)" />
          <Skeleton height="3.5rem" borderRadius="var(--radius-md)" count={4} />
        </div>
      ) : (
        <EditProductDrawerInner
          productId={productId}
          initialData={detailToFormData(detail)}
          version={detail.version}
          onClose={onClose}
          onProductUpdated={onProductUpdated}
        />
      )}
    </Drawer>
  )
}

function EditProductDrawerInner({
  productId,
  initialData,
  version,
  onClose,
  onProductUpdated,
}: {
  productId: string
  initialData: ProductFormData
  version?: number
  onClose: () => void
  onProductUpdated?: (updated: { id: string; name: string; salePrice: number }) => void
}) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { categories: taxCategories } = useTaxCategories(businessId)

  const handleSuccess = useCallback(
    (res: { name: string }) => {
      onProductUpdated?.({ id: productId, name: res.name, salePrice: form.salePrice })
      onClose()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productId, onProductUpdated, onClose],
  )

  const {
    form,
    errors,
    isSubmitting,
    isEditMode,
    activeSection,
    setActiveSection,
    updateField,
    handleSubmit,
    conflictReconcile,
  } = useProductForm({
    editId: productId,
    initialData,
    version,
    onSuccess: handleSuccess,
  })

  return (
    <div className="p-4 space-y-4 pb-20">
      <Tabs
        value={activeSection}
        onValueChange={(val) => setActiveSection(val as 'basic' | 'stock' | 'extra')}
        className="w-full"
      >
        <TabsList variant="line" aria-label={t.formSections} className="mb-4">
          {PRODUCT_FORM_SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {s.label}
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

      <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
        <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
          {t.cancel || 'Cancel'}
        </Button>
        <Button
          variant="primary"
          type="button"
          loading={isSubmitting}
          onClick={() => handleSubmit()}
        >
          {t.updateProductBtn || 'Update Product'}
        </Button>
      </div>

      <ConflictDialog
        conflict={conflictReconcile.conflict}
        overwriting={conflictReconcile.overwriting}
        onReload={conflictReconcile.reload}
        onOverwrite={conflictReconcile.overwrite}
        onDismiss={conflictReconcile.dismiss}
      />
    </div>
  )
}
