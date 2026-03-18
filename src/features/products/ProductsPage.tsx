/** Products — List page (lazy loaded) */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Package, ScanBarcode, BookOpen } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
import { useProducts } from './useProducts'
import { ProductSummaryBar } from './components/ProductSummaryBar'
import { ProductFilterBar } from './components/ProductFilterBar'
import { ProductCard } from './components/ProductCard'
import { ProductListSkeleton } from './components/ProductListSkeleton'
import { deleteProduct, getProductByBarcode } from './product.service'
import { BarcodeScanner } from './components/BarcodeScanner'
import './barcode.css'
import { ROUTES } from '@/config/routes.config'
import type { BulkAction } from '@/components/ui/BulkActionBar'
import './products.css'

export default function ProductsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data, status, filters, setSearch, setFilter, refresh } = useProducts()
  const bulk = useBulkSelect()
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  const handleBarcodeScan = async (value: string) => {
    setScannerOpen(false)
    const product = await getProductByBarcode(value)
    if (product) {
      navigate(`/products/${product.id}`)
    } else {
      toast.error(`No product found for barcode: ${value}`)
    }
  }

  const handleProductClick = (id: string) => {
    if (bulk.isActive) {
      bulk.toggle(id)
    } else {
      navigate(`/products/${id}`)
    }
  }

  const handleLongPress = (id: string) => {
    if (!bulk.isActive) {
      bulk.toggle(id)
    }
  }

  const handleCategoryChange = (value: string | 'ALL') => {
    setFilter('categoryId', value === 'ALL' ? undefined : value)
  }
  const goToCreate = () => navigate(ROUTES.PRODUCT_NEW)

  const handleBulkDelete = async () => {
    const count = bulk.selectedCount
    setIsBulkDeleting(true)
    try {
      const ids = Array.from(bulk.selectedIds)
      await Promise.all(ids.map((id) => deleteProduct(id)))
      toast.success(`${count} ${count === 1 ? 'product' : 'products'} deleted`)
      bulk.clear()
      refresh()
    } catch {
      toast.error('Failed to delete some products')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const allProductIds = data?.products.map((p) => p.id) ?? []

  const bulkActions: BulkAction[] = [
    {
      id: 'delete',
      label: 'Delete',
      icon: 'delete',
      isDanger: true,
      onClick: handleBulkDelete,
    },
    {
      id: 'export',
      label: 'Export',
      icon: 'export',
      onClick: () => toast.info('Export coming soon'),
    },
  ]

  return (
    <AppShell>
      <Header
        title={bulk.isActive ? `${bulk.selectedCount} Selected` : 'Products'}
        actions={
          !bulk.isActive ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(ROUTES.ITEMS_LIBRARY)} aria-label="Items library">
                <BookOpen size={18} aria-hidden="true" />
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setScannerOpen(true)} aria-label="Scan barcode">
                <ScanBarcode size={20} aria-hidden="true" />
              </button>
            </>
          ) : undefined
        }
      />

      {status === 'success' && data && !bulk.isActive && (
        <div className="page-hero">
          <ProductSummaryBar summary={data.summary} />
        </div>
      )}

      <PageContainer>
        {!bulk.isActive && (
          <ProductFilterBar
            search={filters.search}
            onSearchChange={setSearch}
            activeCategoryId={filters.categoryId ?? 'ALL'}
            onCategoryChange={handleCategoryChange}
          />
        )}

        {status === 'loading' && <ProductListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title="Could not load products"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && data.products.length === 0 && (
          <EmptyState
            icon={<Package size={40} aria-hidden="true" />}
            title="No products yet"
            description="Add your first product to start managing inventory"
            action={
              <button className="btn btn-primary btn-md" onClick={goToCreate} aria-label="Add first product">
                Add Product
              </button>
            }
          />
        )}

        {status === 'success' && data && (
          <div role="status" aria-live="polite" className="sr-only">
            {data.products.length} {data.products.length === 1 ? 'product' : 'products'} found
          </div>
        )}

        {status === 'success' && data && data.products.length > 0 && (
          <>
          <h2 className="sr-only">Product list</h2>
          <div className="product-list stagger-list" role="list" aria-label="Products">
            {data.products.map((product) => (
              <div
                key={product.id}
                className={`product-list-item${bulk.isSelected(product.id) ? ' bulk-selected' : ''}`}
                role="listitem"
              >
                <ProductCard
                  product={product}
                  onClick={handleProductClick}
                  onLongPress={handleLongPress}
                  isSelected={bulk.isSelected(product.id)}
                  isBulkMode={bulk.isActive}
                />
                <div className="divider" aria-hidden="true" />
              </div>
            ))}
          </div>
          </>
        )}
      </PageContainer>

      {!bulk.isActive && (
        <button className="fab" onClick={goToCreate} aria-label="Add new product">
          <Plus size={24} aria-hidden="true" />
        </button>
      )}

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalCount={allProductIds.length}
        onSelectAll={() => bulk.selectAll(allProductIds)}
        onClear={bulk.clear}
        actions={bulkActions}
        isProcessing={isBulkDeleting}
      />
      {scannerOpen && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </AppShell>
  )
}
