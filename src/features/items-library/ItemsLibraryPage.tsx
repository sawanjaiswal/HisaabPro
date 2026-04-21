/** Items Library — Browse and add products from curated database (lazy loaded) */

import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { useItemsLibrary } from './useItemsLibrary'
import { LibraryCategoryGrid } from './components/LibraryCategoryGrid'
import { LibraryItemList } from './components/LibraryItemList'
import type { LibraryItem } from './items-library.types'
import './items-library.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function ItemsLibraryPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const toast = useToast()
  const { search, category, items, total, hasMore, setSearch, setCategory, loadMore } = useItemsLibrary()

  const handleSelect = (item: LibraryItem) => {
    // Navigate to create product pre-filled with library data
    navigate(ROUTES.PRODUCT_NEW, {
      state: {
        libraryItem: {
          name: item.name,
          hsn: item.hsn,
          unit: item.unit,
        },
      },
    })
    toast.success(`${item.name} added — complete the details`)
  }

  return (
    <AppShell>
      <Header title={t.itemsLibrary} backTo={ROUTES.PRODUCTS} />

      <PageContainer className="space-y-6">
        <div className="library-search fade-up">
          <Search size={18} className="library-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="library-search-input"
            placeholder={t.searchItemsLibrary}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t.searchItemsLibrary}
          />
        </div>

        <LibraryCategoryGrid activeCategory={category} onSelect={setCategory} />

        <LibraryItemList
          items={items}
          total={total}
          hasMore={hasMore}
          onSelect={handleSelect}
          onLoadMore={loadMore}
        />
      </PageContainer>
    </AppShell>
  )
}
