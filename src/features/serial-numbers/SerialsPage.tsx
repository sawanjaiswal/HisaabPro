import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Upload, Search, Hash } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useSerialNumbers } from './useSerialNumbers'
import { SerialCard } from './components/SerialCard'
import { STATUS_FILTER_OPTIONS } from './serial-number.constants'
import type { SerialStatus } from './serial-number.types'
import './serial-numbers.css'

export default function SerialsPage() {
  const { t } = useLanguage()
  const { productId = '' } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { serials, total, status, refetch, filters, setSearch, setStatusFilter } = useSerialNumbers(productId)

  return (
    <AppShell>
      <Header
        title={t.serialNumbers}
        actions={
          <div className="serial-header-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(ROUTES.SERIAL_BULK.replace(':productId', productId))} aria-label={t.bulkAddSerialNumbersAria}>
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
              placeholder={t.searchSerialsPlaceholder}
              value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t.searchSerialNumbersAria}
            />
          </div>
          <select
            className="serial-filter-select"
            value={filters.status}
            onChange={(e) => setStatusFilter(e.target.value as SerialStatus | 'all')}
            aria-label={t.filterByStatus}
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
          <ErrorState title={t.couldNotLoadSerials} message={t.checkConnectionTryAgain} onRetry={refetch} />
        )}

        {status === 'success' && serials.length === 0 && (
          <EmptyState
            icon={<Hash size={40} aria-hidden="true" />}
            title={t.noSerialNumbersYet}
            description={t.addSerialsToTrack}
            action={
              <button className="btn btn-primary btn-md" onClick={() => navigate(ROUTES.SERIAL_NEW.replace(':productId', productId))} aria-label={t.addFirstSerialNumberAria}>
                {t.addSerialNumber}
              </button>
            }
          />
        )}

        {status === 'success' && serials.length > 0 && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {total} {total === 1 ? t.serialNumberFound : t.serialNumbersFound}
            </div>
            <div className="serial-list stagger-list" role="list" aria-label={t.serialNumbers}>
              {serials.map((serial) => (
                <div key={serial.id} role="listitem">
                  <SerialCard serial={serial} />
                </div>
              ))}
            </div>
          </>
        )}
      </PageContainer>

      <button className="fab" onClick={() => navigate(ROUTES.SERIAL_NEW.replace(':productId', productId))} aria-label={t.addSerialNumberFab}>
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
