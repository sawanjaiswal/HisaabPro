/** Product Detail — Page (lazy loaded, GPT reskin).
 *
 * Light Header · identity card · 4-up stat row · quick-action row · 5 pill tabs
 * (Overview/Stock/Pricing/Information/History) · dual-action footer. Overview
 * numbers are real (/products/:id/analytics). */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, MoreHorizontal, Package } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useProductDetail } from './useProductDetail'
import { useProductAnalytics } from './useProductAnalytics'
import { deleteProduct } from './product.service'
import { ProductDetailHeader } from './components/ProductDetailHeader'
import { ProductStatRow } from './components/ProductStatRow'
import { ProductActionRow } from './components/ProductActionRow'
import { ProductOverviewTab } from './components/ProductOverviewTab'
import { ProductStockTab } from './components/ProductStockTab'
import { ProductPricingTab } from './components/ProductPricingTab'
import { ProductInfoTab } from './components/ProductInfoTab'
import { StockAdjustModal } from './components/StockAdjustModal'
import type { ProductStockStats } from './product-analytics.types'
import './product-detail.css'
import './barcode.css'

type DetailTab = 'overview' | 'stock' | 'pricing' | 'info' | 'history'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()

  const productId = id ?? ''
  const { product, status, activeTab, setActiveTab, refresh } = useProductDetail(productId)
  const { analytics, isLoading: analyticsLoading, isError: analyticsError } = useProductAnalytics(productId)

  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: t.overviewTab },
    { id: 'stock', label: t.stockTab },
    { id: 'pricing', label: t.pricingTab },
    { id: 'info', label: t.infoTab },
    { id: 'history', label: t.historyTab },
  ]

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

  const goEdit = () => navigate(`/products/${productId}/edit`)
  const soon = () => toast.info(t.comingSoon)

  const headerActions = (
    <>
      <Button variant="ghost" size="sm" onClick={goEdit} aria-label={t.editProduct}>
        <Pencil size={18} aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} aria-label={t.deleteProduct}>
        <Trash2 size={18} aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="sm" onClick={soon} aria-label={t.moreLabel}>
        <MoreHorizontal size={18} aria-hidden="true" />
      </Button>
    </>
  )

  // Stat row falls back to the base product while analytics stream in.
  const stats: ProductStockStats = analytics?.stockStats ?? {
    current: product?.currentStock ?? 0,
    available: product?.currentStock ?? 0,
    reserved: 0,
    minStock: product?.minStockLevel ?? 0,
  }

  return (
    <>
      <AppShell>
        <Header variant="default" title={t.productDetail} backTo={ROUTES.PRODUCTS} actions={headerActions} />

        <PageContainer variant="detail" className="space-y-6">
          {status === 'loading' && (
            <>
              <Skeleton height="7rem" borderRadius="var(--radius-xl)" />
              <Skeleton height="5.5rem" borderRadius="var(--radius-xl)" />
              <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
              <Skeleton height="18rem" borderRadius="var(--radius-xl)" />
            </>
          )}

          {status === 'error' && (
            <ErrorState title={t.couldNotLoadProduct} message={t.checkConnectionRetry} onRetry={refresh} />
          )}

          {status === 'success' && !product && (
            <EmptyState
              icon={<Package size={40} aria-hidden="true" />}
              title={t.productNotFound}
              description={t.productMayBeDeleted}
            />
          )}

          {status === 'success' && product && (
            <div className="stagger-enter space-y-6">
              <div role="status" aria-live="polite" className="sr-only">
                {product.name} {t.detailsLoaded}
              </div>

              <ProductDetailHeader
                product={product}
                onBarcode={soon}
                onToggleSave={() => undefined}
              />

              <ProductStatRow stats={stats} unitLabel={product.unit.symbol} />

              <ProductActionRow
                onAdjustStock={() => setAdjustModalOpen(true)}
                onEditPrice={() => setActiveTab('pricing')}
                onBarcode={soon}
                onDuplicate={soon}
                onMore={soon}
              />

              <div className="pill-tabs product-detail-tabs" role="tablist" aria-label={t.productDetailSections}>
                {TABS.map((tab) => (
                  <Button
                    variant="none"
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
                {activeTab === 'overview' && (
                  <ProductOverviewTab
                    product={product}
                    analytics={analytics}
                    isLoading={analyticsLoading}
                    isError={analyticsError}
                    onRetry={refresh}
                    onAdjust={() => setAdjustModalOpen(true)}
                    onViewStock={() => setActiveTab('stock')}
                    onViewActivity={() => setActiveTab('history')}
                  />
                )}

                {(activeTab === 'stock' || activeTab === 'history') && (
                  <ProductStockTab
                    movements={product.recentMovements}
                    unitSymbol={product.unit.symbol}
                    onAdjust={() => setAdjustModalOpen(true)}
                  />
                )}

                {activeTab === 'pricing' && <ProductPricingTab product={product} />}

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

              <div className="pd-footer">
                <Button variant="outline" className="pd-footer__btn pd-footer__btn--danger" onClick={() => setDeleteOpen(true)}>
                  <Trash2 size={18} aria-hidden="true" />
                  {t.deleteProduct}
                </Button>
                <Button variant="primary" className="pd-footer__btn" onClick={goEdit}>
                  <Pencil size={18} aria-hidden="true" />
                  {t.editProduct}
                </Button>
              </div>

              <StockAdjustModal
                isOpen={adjustModalOpen}
                onClose={() => setAdjustModalOpen(false)}
                productId={product.id}
                productName={product.name}
                unitSymbol={product.unit.symbol}
                onSuccess={() => {
                  refresh()
                }}
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
