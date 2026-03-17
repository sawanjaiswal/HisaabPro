import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
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
      toast.success(`${count} ${count === 1 ? 'party' : 'parties'} deleted`)
      bulk.clear()
      refresh()
    } catch {
      toast.error('Failed to delete some parties')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const allPartyIds = data?.parties.map((p) => p.id) ?? []

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
      <Header title={bulk.isActive ? `${bulk.selectedCount} Selected` : 'Parties'} />

      <PageContainer>
        {status === 'success' && data && !bulk.isActive && <PartySummaryBar summary={data.summary} />}

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
            title="Could not load parties"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && data.parties.length === 0 && (
          <EmptyState
            icon={<Users size={40} aria-hidden="true" />}
            title="No parties yet"
            description="Add your first customer or supplier"
            action={
              <button className="btn btn-primary btn-md" onClick={goToCreate} aria-label="Add first party">
                Add Party
              </button>
            }
          />
        )}

        {status === 'success' && data && (
          <div role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            {data.parties.length} {data.parties.length === 1 ? 'party' : 'parties'} found
          </div>
        )}

        {status === 'success' && data && data.parties.length > 0 && (
          <div className="party-list stagger-list" role="list" aria-label="Parties">
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
        )}
      </PageContainer>

      {!bulk.isActive && (
        <button className="fab" onClick={goToCreate} aria-label="Add new party">
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
