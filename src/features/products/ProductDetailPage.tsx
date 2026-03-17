/** Product Detail — Page (lazy loaded) */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, Package, Info } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import { useProductDetail } from './useProductDetail'
import { deleteProduct } from './product.service'
import { ProductDetailHeader } from './components/ProductDetailHeader'
import { ProductStockTab } from './components/ProductStockTab'
import { StockAdjustModal } from './components/StockAdjustModal'
import { formatProductPrice } from './product.utils'
import { PREDEFINED_CATEGORIES, PREDEFINED_UNITS, STOCK_VALIDATION_LABELS } from './product.constants'
import './product-detail.css'

type DetailTab = 'overview' | 'stock' | 'info'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'stock', label: 'Stock' },
  { id: 'info', label: 'Info' },
]

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const productId = id ?? ''
  const { product, status, activeTab, setActiveTab, refresh } = useProductDetail(productId)

  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = () => {
    setIsDeleting(true)
    deleteProduct(productId)
      .then(() => {
        toast.success('Product deactivated')
        navigate(ROUTES.PRODUCTS)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to delete product'
        toast.error(message)
        setIsDeleting(false)
        setDeleteOpen(false)
      })
  }

  const headerActions = (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/products/${productId}/edit`)} aria-label="Edit product">
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => setDeleteOpen(true)} aria-label="Delete product">
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </>
  )

  return (
    <>
      <AppShell>
        <Header title="Product Detail" backTo={ROUTES.PRODUCTS} actions={headerActions} />

      <PageContainer>
        {status === 'loading' && (
          <>
            <div className="card-primary" style={{ marginBottom: 'var(--space-4)', minHeight: 140 }}>
              <Skeleton height="1.5rem" width="60%" />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Skeleton height="1rem" width="40%" />
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Skeleton height="2.5rem" width="50%" />
              </div>
            </div>
            <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
            </div>
          </>
        )}

        {status === 'error' && (
          <ErrorState
            title="Could not load product"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && !product && (
          <EmptyState
            icon={<Package size={40} aria-hidden="true" />}
            title="Product not found"
            description="This product may have been deleted."
          />
        )}

        {status === 'success' && product && (
          <>
            <div role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              {product.name} details loaded
            </div>
            <ProductDetailHeader product={product} />

            <div className="pill-tabs product-detail-tabs" role="tablist" aria-label="Product detail sections">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  className={`pill-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${activeTab} tab content`}>
              {activeTab === 'overview' && (
                <div className="card product-info-card">
                  <div className="product-info-row">
                    <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>Category</span>
                    <span style={{ fontWeight: 500 }}>
                      {PREDEFINED_CATEGORIES.find((c) => c.id === product.category.id)?.name ?? product.category.name}
                    </span>
                  </div>
                  <div className="product-info-row">
                    <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>Unit</span>
                    <span style={{ fontWeight: 500 }}>
                      {PREDEFINED_UNITS.find((u) => u.id === product.unit.id)?.name ?? product.unit.name} ({product.unit.symbol})
                    </span>
                  </div>
                  <div className="product-info-row">
                    <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>Sale Price</span>
                    <span style={{ fontWeight: 600 }}>{formatProductPrice(product.salePrice)}</span>
                  </div>
                  {product.purchasePrice !== null && (
                    <div className="product-info-row">
                      <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>Purchase</span>
                      <span style={{ fontWeight: 500 }}>{formatProductPrice(product.purchasePrice)}</span>
                    </div>
                  )}
                  <div className="product-info-row">
                    <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>Min Stock</span>
                    <span style={{ fontWeight: 500 }}>
                      {product.minStockLevel > 0 ? `${product.minStockLevel} ${product.unit.symbol}` : 'Not set'}
                    </span>
                  </div>
                  <div className="product-info-row">
                    <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>Validation</span>
                    <span style={{ fontWeight: 500 }}>{STOCK_VALIDATION_LABELS[product.stockValidation]}</span>
                  </div>
                </div>
              )}

              {activeTab === 'stock' && (
                <ProductStockTab
                  movements={product.recentMovements}
                  unitSymbol={product.unit.symbol}
                  onAdjust={() => setAdjustModalOpen(true)}
                />
              )}

              {activeTab === 'info' && (
                <div className="card product-info-card">
                  {product.description && (
                    <div className="product-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem' }}>Description</span>
                      <p style={{ marginTop: 'var(--space-1)', lineHeight: 1.5 }}>{product.description}</p>
                    </div>
                  )}
                  {product.hsnCode && (
                    <div className="product-info-row">
                      <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>HSN Code</span>
                      <span style={{ fontWeight: 500 }}>{product.hsnCode}</span>
                    </div>
                  )}
                  {product.sacCode && (
                    <div className="product-info-row">
                      <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>SAC Code</span>
                      <span style={{ fontWeight: 500 }}>{product.sacCode}</span>
                    </div>
                  )}
                  <div className="product-info-row">
                    <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>SKU</span>
                    <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{product.sku}</span>
                  </div>
                  <div className="product-info-row">
                    <span style={{ color: 'var(--color-gray-400)', fontSize: '0.875rem', minWidth: 100 }}>Status</span>
                    <span className={`badge ${product.status === 'ACTIVE' ? 'badge-paid' : 'badge-pending'}`}>
                      {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {!product.description && !product.hsnCode && !product.sacCode && (
                    <EmptyState
                      icon={<Info size={32} aria-hidden="true" />}
                      title="No additional info"
                      description="Add HSN codes, descriptions, and more when editing."
                    />
                  )}
                </div>
              )}
            </div>

            <StockAdjustModal
              isOpen={adjustModalOpen}
              onClose={() => setAdjustModalOpen(false)}
              productId={product.id}
              productName={product.name}
              unitSymbol={product.unit.symbol}
              onSuccess={refresh}
            />
          </>
        )}
      </PageContainer>
      </AppShell>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Product?"
        description={`"${product?.name ?? 'This product'}" will be deactivated. It will no longer appear in new invoices. Products referenced by invoices cannot be permanently deleted.`}
        isLoading={isDeleting}
      />
    </>
  )
}
