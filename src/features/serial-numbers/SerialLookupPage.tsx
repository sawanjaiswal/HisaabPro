import { Search, Hash } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useSerialLookup } from './useSerialLookup'
import { SerialDetailCard } from './components/SerialDetailCard'
import './serial-numbers.css'

export default function SerialLookupPage() {
  const { result, status, error, searchTerm, setSearchTerm } = useSerialLookup()

  return (
    <AppShell>
      <Header title="Serial Lookup" backTo={true} />

      <PageContainer>
        <div className="serial-lookup-search">
          <Search size={18} aria-hidden="true" className="serial-search__icon" />
          <input
            type="search"
            className="serial-search__input serial-search__input--large"
            placeholder="Enter serial number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search serial number"
            autoFocus
          />
        </div>

        {searchTerm.length > 0 && searchTerm.length < 3 && (
          <p className="serial-lookup-hint">Type at least 3 characters to search</p>
        )}

        {status === 'loading' && (
          <div className="serial-skeleton-list">
            <Skeleton height="10rem" count={1} borderRadius="var(--radius-md)" />
          </div>
        )}

        {status === 'error' && (
          <ErrorState title="Lookup failed" message={error ?? 'Please try again.'} />
        )}

        {status === 'not_found' && (
          <EmptyState
            icon={<Hash size={40} aria-hidden="true" />}
            title="Serial not found"
            description={`No product found with serial "${searchTerm}"`}
          />
        )}

        {status === 'found' && result && <SerialDetailCard serial={result} />}
      </PageContainer>
    </AppShell>
  )
}
