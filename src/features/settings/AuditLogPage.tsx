/** Audit Log Page — Phase 6 PR4 FE
 *
 * /settings/audit — search + filter + per-row diff drawer + redactions.
 * Header actions: filter, export, redactions, (parent renders sync + menu).
 *
 * PinGateProvider auto-opens PinPadSheet on 403 PIN_REQUIRED from any
 * `api()` call, so this page just renders the result; no special PIN UI.
 */

import { useMemo, useState, useEffect } from 'react'
import { ClipboardList, Filter, Search, Shield } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuditLog } from './useAuditLog'
import { AuditLogEntry } from './components/AuditLogEntry'
import { AuditFilterDrawer } from './components/AuditFilterDrawer'
import { AuditDiffDrawer } from './components/AuditDiffDrawer'
import { AuditExportButton } from './components/AuditExportButton'
import { AuditRedactionsManager } from './components/AuditRedactionsManager'
import type { AuditSearchRow } from './audit.types'
import './audit-log.css'

/** Active filter count for the filter-chip badge (excludes the live `q` input). */
function countActive(filters: ReturnType<typeof useAuditLog>['filters']): number {
  let n = 0
  if (filters.entityType) n++
  if (filters.action) n++
  if (filters.userId) n++
  if (filters.dateFrom) n++
  if (filters.dateTo) n++
  return n
}

export default function AuditLogPage() {
  const { t } = useLanguage()
  const audit = useAuditLog()
  const { rows, status, filters, setFilter, setFilters, clearFilters, hasMore, loadMore, isFetchingMore, refresh } = audit

  const [filterOpen, setFilterOpen] = useState(false)
  const [redactionsOpen, setRedactionsOpen] = useState(false)
  const [selected, setSelected] = useState<AuditSearchRow | null>(null)

  const activeCount = useMemo(() => countActive(filters), [filters])

  // When the parent navigates back, close any open drawer to avoid the
  // body-scroll lock leaking past unmount.
  useEffect(() => () => { document.body.style.overflow = '' }, [])

  const headerActions = (
    <>
      <Button variant="none"
        type="button"
        className="staff-action-button"
        onClick={() => setRedactionsOpen(true)}
        aria-label={t.auditRedactionsTitle}
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Shield size={20} aria-hidden="true" />
      </Button>
      <AuditExportButton filters={filters} variant="icon" />
      <Button variant="none"
        type="button"
        className="staff-action-button"
        onClick={() => setFilterOpen(true)}
        aria-label={t.auditFiltersLabel}
        style={{ minWidth: 44, minHeight: 44, position: 'relative' }}
      >
        <Filter size={20} aria-hidden="true" />
        {activeCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-primary-600)',
              color: 'var(--color-gray-0)',
              fontSize: 'var(--fs-2xs)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeCount}
          </span>
        )}
      </Button>
    </>
  )

  return (
    <AppShell>
      <Header title={t.auditLog} backTo={ROUTES.SETTINGS} actions={headerActions} />
      <PageContainer variant="list" className="audit-page space-y-6">

        {/* Search input — debounced inside the hook */}
        <Input
          label={t.auditSearchPlaceholder}
          value={filters.q ?? ''}
          onChange={(e) => setFilter('q', e.target.value)}
          placeholder={t.auditSearchPlaceholder}
          type="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          icon={<Search size={16} aria-hidden="true" />}
        />

        {/* 4 UI states */}

        {status === 'loading' && (
          <div className="audit-list" aria-busy="true" aria-label={t.loadingAuditLog}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                style={{
                  height: 72,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-gray-100)',
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadAuditLog}
            message={t.auditLoadError}
            onRetry={refresh}
          />
        )}

        {status === 'success' && (
          <>
            {rows.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={48} aria-hidden="true" />}
                title={t.auditNoResults}
                description={t.auditEmptyDesc}
              />
            ) : (
              <div className="audit-list stagger-list">
                {rows.map((row) => (
                  <AuditLogEntry
                    key={row.id}
                    entry={row}
                    onSelect={setSelected}
                  />
                ))}

                {hasMore && (
                  <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={loadMore}
                      loading={isFetchingMore}
                    >
                      {t.loadMoreBtn}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </PageContainer>

      <AuditFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        initial={filters}
        onApply={setFilters}
        onClear={clearFilters}
      />

      <AuditDiffDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        entry={selected}
      />

      <AuditRedactionsManager
        open={redactionsOpen}
        onClose={() => setRedactionsOpen(false)}
      />
    </AppShell>
  )
}
