/** PriceListDetailPage — /settings/price-lists/:id */

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Tag, Users, RefreshCw, Share2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { usePriceListDetail, usePriceListMutations, usePriceListEntryMutations } from './price-list-queries'
import { PriceListEntryRow } from './components/PriceListEntryRow'
import { PriceListFormDrawer } from './components/PriceListFormDrawer'
import { PriceListEntryFormDrawer } from './components/PriceListEntryFormDrawer'
import { ConfirmDeleteList } from './components/ConfirmDeleteList'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { PriceListEntry, PriceListEntryFormData, PriceListFormData } from './price-list.types'
import './price-lists.css'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="pl-skeleton" aria-busy="true" aria-label="Loading price list">
      <div className="pl-skeleton__card" style={{ height: 56 }} />
      <div className="pl-skeleton__card" style={{ height: 40 }} />
      {[0, 1, 2].map((i) => <div key={i} className="pl-skeleton__card" style={{ height: 68 }} />)}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PriceListDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const { priceList, status, refresh } = usePriceListDetail(id)
  const { update, remove } = usePriceListMutations()
  const entryMutations = usePriceListEntryMutations(id, priceList?.name ?? '')

  const [editListOpen, setEditListOpen] = useState(false)
  const [deleteListOpen, setDeleteListOpen] = useState(false)
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<PriceListEntry | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<PriceListEntry | null>(null)

  const openEntryCreate = () => { setEditEntry(null); setEntryDrawerOpen(true) }
  const openEntryEdit = (e: PriceListEntry) => { setEditEntry(e); setEntryDrawerOpen(true) }
  const closeEntryDrawer = () => setEntryDrawerOpen(false)

  const handleListUpdate = (data: PriceListFormData) => {
    update.mutate({ id, form: data }, { onSuccess: () => setEditListOpen(false) })
  }

  const handleEntrySubmit = (data: PriceListEntryFormData) => {
    if (editEntry) {
      entryMutations.update.mutate(
        { entryId: editEntry.id, form: data },
        { onSuccess: closeEntryDrawer },
      )
    } else {
      entryMutations.create.mutate(data, { onSuccess: closeEntryDrawer })
    }
  }

  const handleEntryDelete = () => {
    if (!deleteEntry) return
    entryMutations.remove.mutate(
      { entryId: deleteEntry.id, productName: deleteEntry.productName },
      { onSuccess: () => setDeleteEntry(null) },
    )
  }

  const title = priceList?.name ?? t.plPageTitle

  return (
    <AppShell>
      <Header
        title={title}
        backTo={ROUTES.PRICE_LISTS as string}
        actions={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEditListOpen(true)}
            aria-label={t.edit}
          >
            {t.edit}
          </button>
        }
      />

      <PageContainer>
        <div className="pl-detail">

          {/* Loading */}
          {status === 'loading' && <DetailSkeleton />}

          {/* Error */}
          {status === 'error' && (
            <div className="pl-empty" role="alert">
              <Tag size={40} className="pl-empty__icon pl-empty__icon--error" aria-hidden="true" />
              <p className="pl-empty__title">{t.plLoadError}</p>
              <button type="button" className="btn btn-primary" onClick={refresh}>
                <RefreshCw size={16} aria-hidden="true" /> {t.retry}
              </button>
            </div>
          )}

          {/* Success */}
          {status === 'success' && priceList && (
            <>
              {/* Meta row */}
              <div className="pl-detail__meta-row">
                <span className="pl-detail__meta-chip">
                  <Tag size={14} aria-hidden="true" />
                  {priceList.entryCount} {t.plEntries}
                </span>
                <span className="pl-detail__meta-chip">
                  <Users size={14} aria-hidden="true" />
                  {priceList.partyCount} {t.plParties}
                </span>
                {priceList.isDefault && (
                  <span className="pl-card__badge">{t.plDefault}</span>
                )}
              </div>

              {/* Bulk assign CTA — placeholder (wired in Batch 8) */}
              <button
                type="button"
                className="btn btn-outline btn-md"
                disabled
                aria-label={t.plBulkAssign}
                title="Coming in a future update"
              >
                <Share2 size={16} aria-hidden="true" />
                {t.plBulkAssign}
              </button>

              {/* Entries */}
              <div>
                <div className="pl-detail__section-header">
                  <span className="pl-detail__section-title">{t.plEntriesTitle}</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={openEntryCreate}>
                    <Plus size={14} aria-hidden="true" /> {t.plAddEntry}
                  </button>
                </div>

                {priceList.entries.length === 0 ? (
                  <div className="pl-empty">
                    <Tag size={32} className="pl-empty__icon" aria-hidden="true" />
                    <p className="pl-empty__title">{t.plNoEntries}</p>
                    <p className="pl-empty__body">{t.plNoEntriesDesc}</p>
                  </div>
                ) : (
                  <div className="pl-entries" role="table" aria-label={t.plEntriesTitle}>
                    {priceList.entries.map((entry) => (
                      <PriceListEntryRow
                        key={entry.id}
                        entry={entry}
                        onEdit={() => openEntryEdit(entry)}
                        onDelete={() => setDeleteEntry(entry)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-md btn-danger"
                  onClick={() => setDeleteListOpen(true)}
                >
                  {t.plDeleteList}
                </button>
              </div>
            </>
          )}
        </div>
      </PageContainer>

      {/* Edit list drawer */}
      <PriceListFormDrawer
        open={editListOpen}
        initial={priceList}
        isLoading={update.isPending}
        onClose={() => setEditListOpen(false)}
        onSubmit={handleListUpdate}
      />

      {/* Delete list */}
      <ConfirmDeleteList
        priceList={deleteListOpen && priceList ? priceList : null}
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate({ id, name: priceList?.name ?? '' }, { onSuccess: () => setDeleteListOpen(false) })}
        onClose={() => setDeleteListOpen(false)}
      />

      {/* Entry form drawer */}
      <PriceListEntryFormDrawer
        open={entryDrawerOpen}
        initial={editEntry}
        isLoading={entryMutations.create.isPending || entryMutations.update.isPending}
        onClose={closeEntryDrawer}
        onSubmit={handleEntrySubmit}
      />

      {/* Delete entry */}
      <ConfirmDialog
        open={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        onConfirm={handleEntryDelete}
        title={t.plEntryDeleteTitle}
        description={deleteEntry ? `${t.plEntryDeleteDesc} "${deleteEntry.productName}"?` : ''}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        isDanger
        isLoading={entryMutations.remove.isPending}
      />
    </AppShell>
  )
}
