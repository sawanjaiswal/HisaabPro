import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Upload, Search, Hash } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useSerialNumbers } from './useSerialNumbers'
import { SerialCard } from './components/SerialCard'
import { STATUS_FILTER_OPTIONS } from './serial-number.constants'
import type { SerialStatus } from './serial-number.types'
import './serial-numbers.css'

export default function SerialsPage() {
  const { productId = '' } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { serials, total, status, refetch, filters, setSearch, setStatusFilter } = useSerialNumbers(productId)

  return (
    <AppShell>
      <Header
        title="Serial Numbers"
        actions={
          <div className="serial-header-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(ROUTES.SERIAL_BULK.replace(':productId', productId))} aria-label="Bulk add serial numbers">
              <Upload size={18} aria-hidden="true" />
            </button>
          </div>
        }
      />

      <PageContainer>
        <div className="serial-filter-bar">
          <div className="serial-search">
            <Search size={16} aria-hidden="true" className="serial-search__icon" />
            <input
              type="search"
              className="serial-search__input"
              placeholder="Search serials..."
              value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search serial numbers"
            />
          </div>
          <select
            className="serial-filter-select"
            value={filters.status}
            onChange={(e) => setStatusFilter(e.target.value as SerialStatus | 'all')}
            aria-label="Filter by status"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {status === 'loading' && (
          <div className="serial-skeleton-list">
            <Skeleton height="4.5rem" count={5} borderRadius="var(--radius-md)" />
          </div>
        )}

        {status === 'error' && (
          <ErrorState title="Could not load serial numbers" message="Check your connection and try again." onRetry={refetch} />
        )}

        {status === 'success' && serials.length === 0 && (
          <EmptyState
            icon={<Hash size={40} aria-hidden="true" />}
            title="No serial numbers yet"
            description="Add serial numbers to track individual items"
            action={
              <button className="btn btn-primary btn-md" onClick={() => navigate(ROUTES.SERIAL_NEW.replace(':productId', productId))} aria-label="Add first serial number">
                Add Serial Number
              </button>
            }
          />
        )}

        {status === 'success' && serials.length > 0 && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {total} serial {total === 1 ? 'number' : 'numbers'} found
            </div>
            <div className="serial-list stagger-list" role="list" aria-label="Serial numbers">
              {serials.map((serial) => (
                <div key={serial.id} role="listitem">
                  <SerialCard serial={serial} />
                </div>
              ))}
            </div>
          </>
        )}
      </PageContainer>

      <button className="fab" onClick={() => navigate(ROUTES.SERIAL_NEW.replace(':productId', productId))} aria-label="Add serial number">
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
