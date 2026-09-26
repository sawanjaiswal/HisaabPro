import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Package, Camera, Upload, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { ListLoadMore } from '@/components/ui/ListLoadMore'
import { Button } from '@/components/ui/Button'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useProducts } from './useProducts'
import { useProductFilterActions } from './useProductFilterActions'
import { useProductBulkActions } from './useProductBulkActions'
import { ProductSummaryBar } from './components/ProductSummaryBar'
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
import type { ProductStatusFilter } from '@/lib/types/product.types'
import './barcode.css'
import './products.css'
import './products-redesign.css'
import { Heading } from '@/components/ui/Heading'

export default function ProductsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()
  // Arriving from the Categories list (#53) pre-applies that category.
  const [searchParams] = useSearchParams()
  const categoryIdFromUrl = searchParams.get('categoryId') ?? undefined
  const { data, status, filters, setSearch, setFilter, refresh, handleDelete, hasMore, loadMore, isLoadingMore } = useProducts({
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

  const productsList = data?.products ?? []
  const allProductIds = productsList.map((p) => p.id)

  return (
    <AppShell>
      <Header
        scrollCondense
        title={bulk.isActive ? `${bulk.selectedCount} ${t.selected}` : (t.products ?? 'Products')}
        actions={
          !bulk.isActive ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScannerOpen(true)}
                aria-label={t.scanBarcode ?? 'Scan Barcode'}
              >
                <Camera size={18} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(ROUTES.IMPORTS)}
                aria-label={t.import ?? 'Import'}
              >
                <Upload size={18} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToCreate}
                aria-label={t.addFirstProduct ?? 'Add Product'}
              >
                <Plus size={20} aria-hidden="true" />
              </Button>
            </div>
          ) : undefined
        }
      />

      <HeroPage>
        {!bulk.isActive && status === 'success' && data && (
          <ProductSummaryBar
            summary={data.summary}
            onLowStockClick={enableLowStock}
            onStockValueClick={() => toast.info(t.comingSoon)}
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

        {status === 'success' && data && productsList.length === 0 && (
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

        {status === 'success' && data && (
          <div role="status" aria-live="polite" className="sr-only">
            {productsList.length} {productsList.length === 1 ? t.item : t.items}
          </div>
        )}

        {status === 'success' && data && productsList.length > 0 && (
          <div className="product-list-section">
            <ProductListHeader
              total={data.pagination?.total ?? productsList.length}
              activeSortBy={filters.sortBy}
              onSortChange={(sortBy) => setFilter('sortBy', sortBy)}
            />
            <Heading level={2} className="sr-only">{t.productList}</Heading>
            <div className="product-list stagger-list" role="list" aria-label={t.products}>
              {productsList.map((product) => (
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
            <ListLoadMore
              hasMore={hasMore}
              isLoading={isLoadingMore}
              onLoadMore={loadMore}
              ariaLabel={t.loadMoreProducts}
            />
            {!bulk.isActive && (
              <ProductStockHealthCard
                lowStockCount={data.summary?.lowStockCount ?? 0}
                onViewLowStock={enableLowStock}
              />
            )}
          </div>
        )}
      </HeroPage>



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
        onStatusChange={(s: ProductStatusFilter | undefined) => setFilter('status', s)}
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
