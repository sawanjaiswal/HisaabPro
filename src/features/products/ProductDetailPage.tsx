/** Product Detail — Page (lazy loaded) */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, Package } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useProductDetail } from './useProductDetail'
import { deleteProduct } from './product.service'
import { ProductDetailHeader } from './components/ProductDetailHeader'
import { ProductStockTab } from './components/ProductStockTab'
import { StockAdjustModal } from './components/StockAdjustModal'
import { ProductInfoTab } from './components/ProductInfoTab'
import { ProductOverviewTab } from './components/ProductOverviewTab'
import './product-detail.css'
import './barcode.css'
import { Button } from '@/components/ui/Button'

type DetailTab = 'overview' | 'stock' | 'info'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: t.overviewTab },
    { id: 'stock', label: t.stockTab },
    { id: 'info', label: t.infoTab },
  ]
  const productId = id ?? ''
  const { product, status, activeTab, setActiveTab, refresh } = useProductDetail(productId)

  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = () => {
    setIsDeleting(true)
    deleteProduct(productId)
      .then(() => {
        toast.success(t.productDeactivated)
        navigate(ROUTES.PRODUCTS)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : t.failedDeleteProductDefault
        toast.error(message)
        setIsDeleting(false)
        setDeleteOpen(false)
      })
  }

  const headerActions = (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate(`/products/${productId}/edit`)} aria-label={t.editProduct}>
        <Pencil size={18} aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} aria-label={t.deleteProduct}>
        <Trash2 size={18} aria-hidden="true" />
      </Button>
    </>
  )

  return (
    <>
      <AppShell>
        <Header title={t.productDetail} backTo={ROUTES.PRODUCTS} actions={headerActions} />

      <PageContainer variant="detail" className="space-y-6">
        {status === 'loading' && (
          <>
            <div className="card-primary product-detail-skeleton-card">
              <Skeleton height="1.5rem" width="60%" />
              <div className="product-detail-skeleton-row">
                <Skeleton height="1rem" width="40%" />
              </div>
              <div className="product-detail-skeleton-row--lg">
                <Skeleton height="2.5rem" width="50%" />
              </div>
            </div>
            <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
            <div className="product-detail-skeleton-row--lg">
              <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
            </div>
          </>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadProduct}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && !product && (
          <EmptyState
            icon={<Package size={40} aria-hidden="true" />}
            title={t.productNotFound}
            description={t.productMayBeDeleted}
          />
        )}

        {status === 'success' && product && (
          <div className="stagger-enter">
            <div role="status" aria-live="polite" className="sr-only">
              {product.name} {t.detailsLoaded}
            </div>
            <ProductDetailHeader product={product} />

            <div className="pill-tabs product-detail-tabs" role="tablist" aria-label={t.productDetailSections}>
              {TABS.map((tab) => (
                <Button variant="none"
                  key={tab.id}
                  role="tab"
                  className={`pill-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${activeTab} ${t.tabContent}`}>
              {activeTab === 'overview' && <ProductOverviewTab product={product} />}

              {activeTab === 'stock' && (
                <ProductStockTab
                  movements={product.recentMovements}
                  unitSymbol={product.unit.symbol}
                  onAdjust={() => setAdjustModalOpen(true)}
                />
              )}

              {activeTab === 'info' && (
                <ProductInfoTab
                  description={product.description}
                  hsnCode={product.hsnCode}
                  sacCode={product.sacCode}
                  sku={product.sku}
                  barcode={product.barcode}
                  barcodeFormat={product.barcodeFormat}
                  status={product.status}
                  stockValidation={product.stockValidation}
                />
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
          </div>
        )}
      </PageContainer>
      </AppShell>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t.deleteProductTitle}
        description={`"${product?.name ?? t.product}" ${t.deleteProductDesc}`}
        isLoading={isDeleting}
      />
    </>
  )
}
