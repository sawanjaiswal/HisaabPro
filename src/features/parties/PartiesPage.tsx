import { useNavigate } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useParties } from './useParties'
import { PartySummaryBar } from './components/PartySummaryBar'
import { PartyFilterBar } from './components/PartyFilterBar'
import { PartyCard } from './components/PartyCard'
import { PartyListSkeleton } from './components/PartyListSkeleton'
import { ROUTES } from '@/config/routes.config'
import type { PartyType } from './party.types'
import './parties.css'

const PARTY_NEW_ROUTE = ROUTES.PARTY_NEW

export default function PartiesPage() {
  const navigate = useNavigate()
  const { data, status, filters, setSearch, setFilter, refresh } = useParties()

  const handlePartyClick = (id: string) => navigate(`/parties/${id}`)
  const handleTypeChange = (value: PartyType | 'ALL') => setFilter('type', value)
  const goToCreate = () => navigate(PARTY_NEW_ROUTE)

  return (
    <AppShell>
      <Header title="Parties" />

      <PageContainer>
        {status === 'success' && data && <PartySummaryBar summary={data.summary} />}

        <PartyFilterBar
          search={filters.search}
          onSearchChange={setSearch}
          activeType={filters.type}
          onTypeChange={handleTypeChange}
        />

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

        {status === 'success' && data && data.parties.length > 0 && (
          <div className="party-list" role="list" aria-label="Parties">
            {data.parties.map((party) => (
              <div key={party.id} className="party-list-item" role="listitem">
                <PartyCard party={party} onClick={handlePartyClick} />
                <div className="divider" aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
      </PageContainer>

      <button className="fab" onClick={goToCreate} aria-label="Add new party">
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
