/** PriceListsPage — /settings/price-lists, mockup #55.
 *
 * Search → rows carrying name, coverage and the default marker. Editing and
 * deleting a list happen on its detail page; this screen only finds and opens.
 * The filter is in-memory: a business runs a handful of price lists, not a feed.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { usePriceLists, usePriceListMutations } from './price-list-queries'
import { PriceListRow } from './components/PriceListRow'
import { PriceListEmpty } from './components/PriceListEmpty'
import { PriceListFormDrawer } from './components/PriceListFormDrawer'
import type { PriceList, PriceListFormData } from './price-list.types'
import './price-lists.css'

function PriceListSkeleton() {
  return (
    <div className="pl-skeleton" aria-busy="true">
      {[0, 1, 2].map((i) => <div key={i} className="pl-skeleton__card" />)}
    </div>
  )
}

export default function PriceListsPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { items, status, refresh } = usePriceLists()
  const { create } = usePriceListMutations()

  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const visible: PriceList[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter((pl) => pl.name.toLowerCase().includes(q)) : items
  }, [items, search])

  const openCreate = () => setDrawerOpen(true)
  const closeDrawer = () => setDrawerOpen(false)

  const handleSubmit = (data: PriceListFormData) => {
    create.mutate(data, { onSuccess: closeDrawer })
  }

  return (
    <AppShell>
      <Header
        title={t.plPageTitle}
        backTo={ROUTES.SETTINGS}
        actions={
          <Button type="button" variant="ghost" size="sm" onClick={openCreate} aria-label={t.plCreate}>
            <Plus size={20} aria-hidden="true" />
          </Button>
        }
      />

      <PageContainer variant="list" className="space-y-6">
        <div className="search-bar">
          <Search size={18} aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.plSearch}
            aria-label={t.plSearch}
          />
        </div>

        {/* Loading */}
        {status === 'loading' && <PriceListSkeleton />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState title={t.plLoadError} message={t.checkConnectionRetry} onRetry={refresh} />
        )}

        {/* Empty — nothing at all vs nothing matching */}
        {status === 'success' && visible.length === 0 && (
          items.length === 0
            ? <PriceListEmpty onAdd={openCreate} />
            : <EmptyState title={t.noResults} description={t.tryDifferentSearch} />
        )}

        {/* Success */}
        {status === 'success' && visible.length > 0 && (
          <div className="pl-row-list stagger-list" role="list" aria-label={t.plPageTitle}>
            {visible.map((pl) => (
              <PriceListRow
                key={pl.id}
                priceList={pl}
                onOpen={(id) => navigate(ROUTES.PRICE_LIST_DETAIL.replace(':id', id))}
              />
            ))}
          </div>
        )}
      </PageContainer>

      <PriceListFormDrawer
        open={drawerOpen}
        initial={null}
        isLoading={create.isPending}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
      />
    </AppShell>
  )
}
