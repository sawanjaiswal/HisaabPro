/** PriceListsPage — /settings/price-lists — list with 4 UI states */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Tag, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { usePriceLists, usePriceListMutations } from './price-list-queries'
import { PriceListCard } from './components/PriceListCard'
import { PriceListEmpty } from './components/PriceListEmpty'
import { PriceListFormDrawer } from './components/PriceListFormDrawer'
import { ConfirmDeleteList } from './components/ConfirmDeleteList'
import type { PriceList, PriceListFormData } from './price-list.types'
import './price-lists.css'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PriceListSkeleton() {
  return (
    <div className="pl-skeleton" aria-busy="true" aria-label="Loading price lists">
      {[0, 1, 2].map((i) => <div key={i} className="pl-skeleton__card" />)}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PriceListsPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { items, status, refresh } = usePriceLists()
  const { create, update, remove } = usePriceListMutations()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PriceList | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PriceList | null>(null)

  const openCreate = () => { setEditTarget(null); setDrawerOpen(true) }
  const openEdit = (pl: PriceList) => { setEditTarget(pl); setDrawerOpen(true) }
  const closeDrawer = () => setDrawerOpen(false)

  const handleSubmit = (data: PriceListFormData) => {
    if (editTarget) {
      update.mutate({ id: editTarget.id, form: data }, { onSuccess: closeDrawer })
    } else {
      create.mutate(data, { onSuccess: closeDrawer })
    }
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    remove.mutate({ id: deleteTarget.id, name: deleteTarget.name }, { onSuccess: () => setDeleteTarget(null) })
  }

  const isMutating = create.isPending || update.isPending

  return (
    <AppShell>
      <Header
        title={t.plPageTitle}
        backTo={ROUTES.SETTINGS}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate} aria-label={t.plCreate}>
            <Plus size={18} aria-hidden="true" />
          </button>
        }
      />

      <PageContainer>
        <div className="pl-page">
          {/* Loading */}
          {status === 'loading' && <PriceListSkeleton />}

          {/* Error */}
          {status === 'error' && (
            <div className="pl-empty" role="alert">
              <Tag size={40} className="pl-empty__icon pl-empty__icon--error" aria-hidden="true" />
              <p className="pl-empty__title">{t.plLoadError}</p>
              <p className="pl-empty__body">{t.checkConnectionRetry}</p>
              <button type="button" className="btn btn-primary" onClick={refresh}>
                <RefreshCw size={16} aria-hidden="true" />
                {t.retry}
              </button>
            </div>
          )}

          {/* Empty */}
          {status === 'success' && items.length === 0 && (
            <PriceListEmpty onAdd={openCreate} />
          )}

          {/* List */}
          {status === 'success' && items.length > 0 && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
              role="list"
              aria-label={t.plPageTitle}
            >
              {items.map((pl) => (
                <div key={pl.id} role="listitem">
                  <PriceListCard
                    priceList={pl}
                    onClick={() => navigate(ROUTES.PRICE_LIST_DETAIL.replace(':id', pl.id))}
                    onEdit={(e) => { e.stopPropagation(); openEdit(pl) }}
                    onDelete={(e) => { e.stopPropagation(); setDeleteTarget(pl) }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </PageContainer>

      {/* FAB */}
      <button type="button" className="fab" onClick={openCreate} aria-label={t.plCreate}>
        <Plus size={24} aria-hidden="true" />
      </button>

      {/* Drawers / dialogs */}
      <PriceListFormDrawer
        open={drawerOpen}
        initial={editTarget}
        isLoading={isMutating}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
      />

      <ConfirmDeleteList
        priceList={deleteTarget}
        isLoading={remove.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </AppShell>
  )
}
