/** Products — List page (GPT mockup redesign, lazy loaded).
 * Title + scan/add · 4 stat tiles · search + chip filters · sortable rows ·
 * "keep stock healthy" footer. Bulk-select (long-press) reuses BulkActionBar.
 */

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Package } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { Button } from '@/components/ui/Button'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useProducts } from './useProducts'
import { useProductFilterActions } from './useProductFilterActions'
import { useProductBulkActions } from './useProductBulkActions'
import { ProductsPageHeader } from './components/ProductsPageHeader'
import { ProductStatTiles } from './components/ProductStatTiles'
import { ProductFilterBar } from './components/ProductFilterBar'
import { ProductListHeader } from './components/ProductListHeader'
import { ProductCard } from './components/ProductCard'
import { ProductStockHealthCard } from './components/ProductStockHealthCard'
import { ProductCategoryDrawer } from './components/ProductCategoryDrawer'
import { ProductFilterDrawer } from './components/ProductFilterDrawer'
import { ProductListSkeleton } from './components/ProductListSkeleton'
import { getProductByBarcode } from './product.service'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import { LabelPrintDialog } from './label-print/LabelPrintDialog'
import { ROUTES } from '@/config/routes.config'
import type { ProductStatus } from '@/lib/types/product.types'
import './barcode.css'
import './products.css'
import './products-redesign.css'

export default function ProductsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()
  // Arriving from the Categories list (#53) pre-applies that category.
  const [searchParams] = useSearchParams()
  const categoryIdFromUrl = searchParams.get('categoryId') ?? undefined
  const { data, status, filters, setSearch, setFilter, refresh, handleDelete } = useProducts({
    initialFilters: categoryIdFromUrl ? { categoryId: categoryIdFromUrl } : undefined,
  })
  const bulk = useBulkSelect()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [labelPrintOpen, setLabelPrintOpen] = useState(false)
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)

  const { bulkActions, isBulkDeleting } = useProductBulkActions({
    selectedIds: bulk.selectedIds,
    selectedCount: bulk.selectedCount,
    clear: bulk.clear,
    refresh,
    openLabelPrint: () => setLabelPrintOpen(true),
  })

  const {
    mode, categoryActive, filtersActive,
    enableLowStock, showAll, toggleLowStock, selectCategory, resetFilters,
  } = useProductFilterActions(filters, setFilter)

  const handleBarcodeScan = async (value: string) => {
    setScannerOpen(false)
    const product = await getProductByBarcode(value)
    if (product) navigate(`/products/${product.id}`)
    else toast.error(`${t.noBarcodeProdFound}: ${value}`)
  }

  const handleProductClick = (id: string) => {
    if (bulk.isActive) bulk.toggle(id)
    else navigate(`/products/${id}`)
  }

  const handleLongPress = (id: string) => { if (!bulk.isActive) bulk.toggle(id) }

  const goToCreate = () => navigate(ROUTES.PRODUCT_NEW)
  const goToEdit = (id: string) => navigate(`/products/${id}/edit`)

  const allProductIds = data?.products.map((p) => p.id) ?? []

  return (
    <AppShell>
      <Header
        scrollCondense
        title={bulk.isActive ? `${bulk.selectedCount} ${t.selected}` : undefined}
      />

      <PageContainer variant="list" className="space-y-6">
        {!bulk.isActive && (
          <ProductsPageHeader onScan={() => setScannerOpen(true)} onAdd={goToCreate} />
        )}

        {status === 'success' && data && !bulk.isActive && (
          <ProductStatTiles
            summary={data.summary}
            onLowStock={enableLowStock}
            onValue={() => toast.info(t.comingSoon)}
            onOutOfStock={() => toast.info(t.comingSoon)}
          />
        )}

        {!bulk.isActive && (
          <ProductFilterBar
            search={filters.search}
            onSearchChange={setSearch}
            onScan={() => setScannerOpen(true)}
            mode={mode}
            categoryActive={categoryActive}
            filtersActive={filtersActive}
            lowStockCount={data?.summary?.lowStockCount}
            onSelectAll={showAll}
            onFavorites={() => toast.info(t.comingSoon)}
            onLowStock={toggleLowStock}
            onOpenCategories={() => setCategoryDrawerOpen(true)}
            onOpenFilters={() => setFilterDrawerOpen(true)}
          />
        )}

        {status === 'loading' && <ProductListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadProducts}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && data.products.length === 0 && (
          <EmptyState
            icon={<Package size={40} aria-hidden="true" />}
            title={t.noProductsYet}
            description={t.addFirstProductDesc}
            action={
              <Button variant="primary" size="md" onClick={goToCreate} aria-label={t.addFirstProduct}>
                {t.addProduct}
              </Button>
            }
          />
        )}

        {status === 'success' && data && data.products.length > 0 && (
          <div className="product-list-section" role="status" aria-live="polite">
            <ProductListHeader
              total={data.pagination.total}
              activeSortBy={filters.sortBy}
              onSortChange={(sortBy) => setFilter('sortBy', sortBy)}
            />
            <h2 className="sr-only">{t.productList}</h2>
            <div className="product-list stagger-list" role="list" aria-label={t.products}>
              {data.products.map((product) => (
                <div
                  key={product.id}
                  className={`product-list-item${bulk.isSelected(product.id) ? ' bulk-selected' : ''}`}
                  role="listitem"
                >
                  <ProductCard
                    product={product}
                    onClick={handleProductClick}
                    onEdit={goToEdit}
                    onDelete={handleDelete}
                    onLongPress={handleLongPress}
                    isSelected={bulk.isSelected(product.id)}
                    isBulkMode={bulk.isActive}
                  />
                  <div className="divider" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'success' && data && !bulk.isActive && (
          <ProductStockHealthCard
            lowStockCount={data.summary.lowStockCount}
            onViewLowStock={enableLowStock}
          />
        )}
      </PageContainer>

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalCount={allProductIds.length}
        onSelectAll={() => bulk.selectAll(allProductIds)}
        onClear={bulk.clear}
        actions={bulkActions}
        isProcessing={isBulkDeleting}
      />

      <ProductCategoryDrawer
        open={categoryDrawerOpen}
        onClose={() => setCategoryDrawerOpen(false)}
        activeCategoryId={filters.categoryId ?? 'ALL'}
        onSelect={selectCategory}
      />

      <ProductFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        status={filters.status}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onStatusChange={(s: ProductStatus | undefined) => setFilter('status', s)}
        onSortByChange={(sortBy) => setFilter('sortBy', sortBy)}
        onSortOrderChange={(order) => setFilter('sortOrder', order)}
        onReset={resetFilters}
      />

      {scannerOpen && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setScannerOpen(false)} />
      )}
      {labelPrintOpen && (
        <LabelPrintDialog
          productIds={Array.from(bulk.selectedIds)}
          onClose={() => { setLabelPrintOpen(false); bulk.clear() }}
        />
      )}
    </AppShell>
  )
}
