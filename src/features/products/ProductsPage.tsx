/** Products — List page (lazy loaded) */

import { useNavigate } from 'react-router-dom'
import { Plus, Package } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useProducts } from './useProducts'
import { ProductSummaryBar } from './components/ProductSummaryBar'
import { ProductFilterBar } from './components/ProductFilterBar'
import { ProductCard } from './components/ProductCard'
import { ProductListSkeleton } from './components/ProductListSkeleton'
import { ROUTES } from '@/config/routes.config'
import './products.css'

export default function ProductsPage() {
  const navigate = useNavigate()
  const { data, status, filters, setSearch, setFilter, refresh } = useProducts()

  const handleProductClick = (id: string) => navigate(`/products/${id}`)
  const handleCategoryChange = (value: string | 'ALL') => {
    setFilter('categoryId', value === 'ALL' ? undefined : value)
  }
  const goToCreate = () => navigate(ROUTES.PRODUCT_NEW)

  return (
    <AppShell>
      <Header title="Products" />

      <PageContainer>
        {status === 'success' && data && <ProductSummaryBar summary={data.summary} />}

        <ProductFilterBar
          search={filters.search}
          onSearchChange={setSearch}
          activeCategoryId={filters.categoryId ?? 'ALL'}
          onCategoryChange={handleCategoryChange}
        />

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

        {status === 'success' && data && data.products.length > 0 && (
          <div className="product-list" role="list" aria-label="Products">
            {data.products.map((product) => (
              <div key={product.id} className="product-list-item" role="listitem">
                <ProductCard product={product} onClick={handleProductClick} />
                <div className="divider" aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
      </PageContainer>

      <button className="fab" onClick={goToCreate} aria-label="Add new product">
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
