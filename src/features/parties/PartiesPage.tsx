import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Upload } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useParties } from './useParties'
import { PartySummaryBar } from './components/PartySummaryBar'
import { PartyFilterBar } from './components/PartyFilterBar'
import { PartyCard } from './components/PartyCard'
import { PartyListSkeleton } from './components/PartyListSkeleton'
import { deleteParty } from './party.service'
import { ROUTES } from '@/config/routes.config'
import type { PartyType } from './party.types'
import type { BulkAction } from '@/components/ui/BulkActionBar'
import './parties.css'

const PARTY_NEW_ROUTE = ROUTES.PARTY_NEW

export default function PartiesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()
  const { data, status, filters, setSearch, setFilter, refresh } = useParties()
  const bulk = useBulkSelect()
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

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

  const handleTypeChange = (value: PartyType | 'ALL') => setFilter('type', value)
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
        title={bulk.isActive ? `${bulk.selectedCount} ${t.selected}` : t.parties}
        actions={
          !bulk.isActive ? (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(ROUTES.BULK_IMPORT_PARTIES)} aria-label={t.importPartiesLabel}>
              <Upload size={18} aria-hidden="true" />
              <span>{t.import}</span>
            </button>
          ) : undefined
        }
      />

      {status === 'success' && data && !bulk.isActive && (
        <div className="page-hero">
          <PartySummaryBar summary={data.summary} />
        </div>
      )}

      <PageContainer className="space-y-6">
        {!bulk.isActive && (
          <PartyFilterBar
            search={filters.search}
            onSearchChange={setSearch}
            activeType={filters.type}
            onTypeChange={handleTypeChange}
          />
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
              <button className="btn btn-primary btn-md" onClick={goToCreate} aria-label={t.addFirstPartyLabel}>
                {t.addParty}
              </button>
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
          <h2 className="sr-only">{t.partyList}</h2>
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
                />
                <div className="divider" aria-hidden="true" />
              </div>
            ))}
          </div>
          </>
        )}
      </PageContainer>

      {!bulk.isActive && (
        <button className="fab" onClick={goToCreate} aria-label={t.addNewPartyLabel}>
          <Plus size={24} aria-hidden="true" />
        </button>
      )}

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
