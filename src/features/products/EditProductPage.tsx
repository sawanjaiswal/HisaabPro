/** Edit Product — Page (lazy loaded)
 *
 * Fetches existing product data, converts ProductDetail → ProductFormData,
 * then reuses the same form components as CreateProductPage.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { getProduct } from './product.service'
import { EditProductForm } from './components/EditProductForm'
import type { ProductFormData, ProductDetail } from './product.types'

/** Convert server ProductDetail → form-compatible ProductFormData */
function detailToFormData(detail: ProductDetail): ProductFormData {
  return {
    name: detail.name,
    sku: detail.sku,
    autoGenerateSku: false,
    categoryId: detail.category.id,
    unitId: detail.unit.id,
    salePrice: detail.salePrice,
    purchasePrice: detail.purchasePrice ?? 0,
    openingStock: detail.currentStock,
    minStockLevel: detail.minStockLevel,
    stockValidation: detail.stockValidation,
    barcode: detail.barcode ?? undefined,
    barcodeFormat: detail.barcodeFormat ?? undefined,
    hsnCode: detail.hsnCode ?? '',
    sacCode: detail.sacCode ?? undefined,
    taxCategoryId: detail.taxCategory?.id ?? null,
    description: detail.description ?? '',
    status: detail.status,
  }
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const productId = id ?? ''
  const [loadStatus, setLoadStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [initialData, setInitialData] = useState<ProductFormData | undefined>()

  useEffect(() => {
    const controller = new AbortController()
    setLoadStatus('loading')
    getProduct(productId, controller.signal)
      .then((detail) => { setInitialData(detailToFormData(detail)); setLoadStatus('ready') })
      .catch((err) => { if (err instanceof Error && err.name === 'AbortError') return; setLoadStatus('error') })
    return () => controller.abort()
  }, [productId])

  if (loadStatus === 'loading') {
    return (
      <AppShell>
        <Header title="Edit Product" backTo={`/products/${productId}`} />
        <PageContainer>
          <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton height="3.5rem" borderRadius="var(--radius-md)" count={5} />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (loadStatus === 'error' || !initialData) {
    return (
      <AppShell>
        <Header title="Edit Product" backTo={`/products/${productId}`} />
        <PageContainer>
          <ErrorState title="Could not load product" message="Check your connection and try again." onRetry={() => window.location.reload()} />
        </PageContainer>
      </AppShell>
    )
  }

  return <EditProductForm productId={productId} initialData={initialData} />
}
