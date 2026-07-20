import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Upload } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useParties } from './useParties'
import { PartySummaryBar } from './components/PartySummaryBar'
import { PartyFilterBar } from './components/PartyFilterBar'
import { PartyFilterDrawer } from './components/PartyFilterDrawer'
import { PartyOutstandingCard } from './components/PartyOutstandingCard'
import { PartyListHeader } from './components/PartyListHeader'
import { PARTY_STATUS_FILTERS, type PartyStatusFilter } from './party.constants'
import { PartyCard } from './components/PartyCard'
import { useOptOutSet } from '@/features/marketing/hooks/useOptOutSet'
import { TagFilterBar } from '@/features/crm/components/TagFilterBar'
import { PartyListSkeleton } from './components/PartyListSkeleton'
import { deleteParty } from './party.service'
import { ROUTES } from '@/config/routes.config'
import type { BulkAction } from '@/components/ui/BulkActionBar'
import './parties.css'
import '@/styles/components.crm.css'
import { Button } from '@/components/ui/Button'

const PARTY_NEW_ROUTE = ROUTES.PARTY_NEW

export default function PartiesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()
  const { data, status, filters, setSearch, setFilter, refresh } = useParties()
  const bulk = useBulkSelect()
  const optOutSet = useOptOutSet()
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [status_, setStatusFilter] = useState<PartyStatusFilter>('ALL')
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)

  const handleStatusChange = (value: PartyStatusFilter) => {
    setStatusFilter(value)
    const mapped = PARTY_STATUS_FILTERS[value]
    setFilter('isActive', mapped.isActive)
    setFilter('hasOutstanding', mapped.hasOutstanding)
  }

  const handlePartyClick = (id: string) => {
    if (bulk.isActive) {
      bulk.toggle(id)
    } else {
      navigate(`/parties/${id}`)
    }
  }

  const handleLongPress = (id: string) => {
    if (!bulk.isActive) {
      bulk.toggle(id)
    }
  }

  const goToCreate = () => navigate(PARTY_NEW_ROUTE)

  const handleBulkDelete = async () => {
    const count = bulk.selectedCount
    setIsBulkDeleting(true)
    try {
      const ids = Array.from(bulk.selectedIds)
      await Promise.all(ids.map((id) => deleteParty(id)))
      toast.success(`${count} ${count === 1 ? t.partyDeleted : t.partiesDeleted}`)
      bulk.clear()
      refresh()
    } catch {
      toast.error(t.failedDeleteParties)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const allPartyIds = data?.parties.map((p) => p.id) ?? []

  const bulkActions: BulkAction[] = [
    {
      id: 'delete',
      label: t.delete,
      icon: 'delete',
      isDanger: true,
      onClick: handleBulkDelete,
    },
    {
      id: 'export',
      label: t.export,
      icon: 'export',
      onClick: () => toast.info(t.exportComingSoon),
    },
  ]

  return (
    <AppShell>
      <Header
        scrollCondense
        title={bulk.isActive ? `${bulk.selectedCount} ${t.selected}` : t.parties}
        actions={
          !bulk.isActive ? (
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                const flag = import.meta.env.VITE_FEATURE_DATA_IMPORT
                const enabled = flag === 'true' || flag === true || flag === '1'
                navigate(enabled ? ROUTES.IMPORTS : ROUTES.BULK_IMPORT_PARTIES)
              }}
              aria-label={t.importPartiesLabel}
            >
              <Upload size={18} aria-hidden="true" />
              <span>{t.import}</span>
            </Button>
          ) : undefined
        }
      />

      <HeroPage>
        {!bulk.isActive && status === 'success' && data && (
          <PartySummaryBar summary={data.summary} />
        )}

        {!bulk.isActive && (
          <>
            <PartyFilterBar
              search={filters.search}
              onSearchChange={setSearch}
              activeType={filters.type}
              onTypeChange={(type) => setFilter('type', type)}
              counts={data?.summary}
              onFilterClick={() => setFilterDrawerOpen(true)}
              hasActiveFilter={status_ !== 'ALL'}
            />
            <TagFilterBar
              activeTag={filters.tag ?? ''}
              onTagChange={(value) => setFilter('tag', value || undefined)}
            />
          </>
        )}

        {status === 'loading' && <PartyListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadParties}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && data.parties.length === 0 && (
          <EmptyState
            icon={<Users size={40} aria-hidden="true" />}
            title={t.noParties}
            description={t.addFirstParty}
            action={
              <Button variant="primary" size="md" onClick={goToCreate} aria-label={t.addFirstPartyLabel}>
                {t.addParty}
              </Button>
            }
          />
        )}

        {status === 'success' && data && (
          <div role="status" aria-live="polite" className="sr-only">
            {data.parties.length} {data.parties.length === 1 ? t.partyFound : t.partiesFound}
          </div>
        )}

        {status === 'success' && data && data.parties.length > 0 && (
          <>
          <div className="party-list-section">
          <PartyListHeader onSortChange={(sortBy) => setFilter('sortBy', sortBy)} />
          <div className="party-list stagger-list" role="list" aria-label={t.parties}>
            {data.parties.map((party) => (
              <div
                key={party.id}
                className={`party-list-item${bulk.isSelected(party.id) ? ' bulk-selected' : ''}`}
                role="listitem"
              >
                <PartyCard
                  party={party}
                  onClick={handlePartyClick}
                  onLongPress={handleLongPress}
                  isSelected={bulk.isSelected(party.id)}
                  isBulkMode={bulk.isActive}
                  isOptedOut={optOutSet.has(party.id)}
                />
                <div className="divider" aria-hidden="true" />
              </div>
            ))}
          </div>
          {!bulk.isActive && (
            <PartyOutstandingCard
              netOutstanding={data.summary.netOutstanding}
              totalParties={data.summary.totalParties}
            />
          )}
          </div>
          </>
        )}
      </HeroPage>

      {!bulk.isActive && status === 'success' && data && data.parties.length > 0 && (
        <Button variant="none" className="fab" onClick={goToCreate} aria-label={t.addNewPartyLabel}>
          <Plus size={24} aria-hidden="true" />
        </Button>
      )}

      <PartyFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        activeStatus={status_}
        onStatusChange={handleStatusChange}
      />

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalCount={allPartyIds.length}
        onSelectAll={() => bulk.selectAll(allPartyIds)}
        onClear={bulk.clear}
        actions={bulkActions}
        isProcessing={isBulkDeleting}
      />
    </AppShell>
  )
}
