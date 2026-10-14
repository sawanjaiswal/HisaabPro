import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Package, Camera, Upload, Plus, Table2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { ListLoadMore } from '@/components/ui/ListLoadMore'
import { Button } from '@/components/ui/Button'
import { Heading } from '@/components/ui/Heading'
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
import { ProductListSkeleton } from './components/ProductListSkeleton'
import { ProductPageOverlays } from './components/ProductPageOverlays'
import { getProductByBarcode } from './product.service'
import { ROUTES } from '@/config/routes.config'
import './barcode.css'
import './products.css'

export default function ProductsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()
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
  const [bulkModalOpen, setBulkModalOpen] = useState(false)

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
              <Button variant="ghost" size="sm" onClick={() => setScannerOpen(true)} aria-label={t.scanBarcode ?? 'Scan Barcode'}>
                <Camera size={18} aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBulkModalOpen(true)} aria-label="Bulk Add Products" title="Bulk Add Products">
                <Table2 size={18} aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.IMPORTS)} aria-label={t.import ?? 'Import'}>
                <Upload size={18} aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToCreate} aria-label={t.addFirstProduct ?? 'Add Product'}>
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
            onLowStockClick={toggleLowStock}
            onStockValueClick={() => navigate(ROUTES.STOCK_VALUE_REPORT)}
            isLowStockActive={filters.lowStockOnly}
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
          <ErrorState title={t.couldNotLoadProducts} message={t.checkConnectionRetry} onRetry={refresh} />
        )}

        {status === 'success' && data && productsList.length === 0 && (
          <EmptyState
            icon={<Package size={40} aria-hidden="true" />}
            title={filters.lowStockOnly ? t.noLowStockProducts : (filters.search || filters.categoryId || filtersActive) ? t.noProductsMatchFilters : t.noProductsYet}
            description={filters.lowStockOnly ? t.noLowStockDesc : (filters.search || filters.categoryId || filtersActive) ? (t.noProductsFound ?? t.checkConnectionRetry) : t.addFirstProductDesc}
            action={
              filters.lowStockOnly || filters.search || filters.categoryId || filtersActive ? (
                <Button variant="secondary" size="md" onClick={showAll} aria-label={filters.lowStockOnly ? t.viewAllProducts : t.clearFilters}>
                  {filters.lowStockOnly ? t.viewAllProducts : t.clearFilters}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="md" onClick={goToCreate} aria-label={t.addFirstProduct}>
                    {t.addProduct}
                  </Button>
                  <Button variant="outline" size="md" onClick={() => setBulkModalOpen(true)} aria-label="Bulk Add Products">
                    <Table2 size={16} className="mr-1.5" aria-hidden="true" />
                    Bulk Add
                  </Button>
                </div>
              )
            }
          />
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
            <ListLoadMore hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={loadMore} ariaLabel={t.loadMoreProducts} />
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

      <ProductPageOverlays
        categoryDrawerOpen={categoryDrawerOpen}
        onCloseCategoryDrawer={() => setCategoryDrawerOpen(false)}
        activeCategoryId={filters.categoryId}
        onSelectCategory={selectCategory}
        filterDrawerOpen={filterDrawerOpen}
        onCloseFilterDrawer={() => setFilterDrawerOpen(false)}
        status={filters.status}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onStatusChange={(s) => setFilter('status', s)}
        onSortByChange={(sortBy) => setFilter('sortBy', sortBy)}
        onSortOrderChange={(order) => setFilter('sortOrder', order)}
        onResetFilters={resetFilters}
        scannerOpen={scannerOpen}
        onCloseScanner={() => setScannerOpen(false)}
        onBarcodeScan={handleBarcodeScan}
        labelPrintOpen={labelPrintOpen}
        onCloseLabelPrint={() => { setLabelPrintOpen(false); bulk.clear() }}
        selectedIds={Array.from(bulk.selectedIds)}
        bulkModalOpen={bulkModalOpen}
        onCloseBulkModal={() => setBulkModalOpen(false)}
        onBulkSuccess={refresh}
      />
    </AppShell>
  )
}
