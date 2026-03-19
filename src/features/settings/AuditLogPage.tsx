import React, { useMemo } from 'react'
import { ClipboardList } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { useAuditLog } from './useAuditLog'
import { AuditLogEntry } from './components/AuditLogEntry'
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from './audit.constants'
import type { AuditAction } from './settings.types'
import './audit-log.css'

const ACTION_FILTERS: Array<{ label: string; value: AuditAction | undefined }> = [
  { label: 'All', value: undefined },
  ...Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => ({
    label,
    value: key as AuditAction,
  })),
]

const ENTITY_FILTERS: Array<{ label: string; value: string | undefined }> = [
  { label: 'All', value: undefined },
  ...Object.entries(AUDIT_ENTITY_LABELS).map(([key, label]) => ({
    label,
    value: key,
  })),
]

function formatDateGroupLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (entryDay.getTime() === today.getTime()) return 'Today'
  if (entryDay.getTime() === yesterday.getTime()) return 'Yesterday'

  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getDateKey(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

interface DateGroup {
  label: string
  dateKey: string
  entryIds: string[]
}

export default function AuditLogPage() {
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { data, status, filters, setFilter, loadMore, refresh } = useAuditLog(businessId)

  const dateGroups = useMemo<DateGroup[]>(() => {
    if (!data) return []

    const groupMap = new Map<string, DateGroup>()

    for (const entry of data.entries) {
      const key = getDateKey(entry.createdAt)
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          label: formatDateGroupLabel(entry.createdAt),
          dateKey: key,
          entryIds: [],
        })
      }
      groupMap.get(key)!.entryIds.push(entry.id)
    }

    return Array.from(groupMap.values())
  }, [data])

  const entryById = useMemo(() => {
    if (!data) return new Map()
    return new Map(data.entries.map((e) => [e.id, e]))
  }, [data])

  const hasMore = data !== null
    ? data.pagination.page * data.pagination.limit < data.pagination.total
    : false

  return (
    <AppShell>
      <Header title="Audit Log" backTo={ROUTES.SETTINGS} />
      <PageContainer className="audit-page">

        <div>
          <p className="settings-section-title" style={{ paddingBottom: 'var(--space-2)' }}>
            Action
          </p>
          <div className="audit-filters" role="group" aria-label="Filter by action">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.label}
                type="button"
                className={`audit-filter-chip${filters.action === f.value ? ' audit-filter-chip--active' : ''}`}
                onClick={() => setFilter('action', f.value)}
                aria-pressed={filters.action === f.value}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="settings-section-title" style={{ paddingBottom: 'var(--space-2)' }}>
            Entity
          </p>
          <div className="audit-filters" role="group" aria-label="Filter by entity type">
            {ENTITY_FILTERS.map((f) => (
              <button
                key={f.label}
                type="button"
                className={`audit-filter-chip${filters.entityType === f.value ? ' audit-filter-chip--active' : ''}`}
                onClick={() => setFilter('entityType', f.value)}
                aria-pressed={filters.entityType === f.value}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {status === 'loading' && (
          <div className="audit-list" aria-busy="true" aria-label="Loading audit log">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                style={{ height: 80, borderRadius: 'var(--radius-lg)', background: 'var(--color-gray-100)', opacity: 0.5 }}
              />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title="Could not load audit log"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && data !== null && (
          <>
            {data.entries.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={48} aria-hidden="true" />}
                title="No audit entries"
                description="Activity will be logged here as your team works."
              />
            ) : (
              <div className="audit-list">
                {dateGroups.map((group) => (
                  <React.Fragment key={group.dateKey}>
                    <div className="audit-date-group" aria-label={`Entries from ${group.label}`}>
                      <span className="audit-date-group-label">{group.label}</span>
                      <span className="audit-date-group-line" aria-hidden="true" />
                    </div>
                    {group.entryIds.map((id) => {
                      const entry = entryById.get(id)
                      if (!entry) return null
                      return <AuditLogEntry key={entry.id} entry={entry} />
                    })}
                  </React.Fragment>
                ))}

                {hasMore && (
                  <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                    <button
                      type="button"
                      onClick={loadMore}
                      style={{
                        padding: 'var(--space-3) var(--space-6)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1.5px solid var(--color-gray-300)',
                        background: 'var(--color-gray-0, #fff)',
                        color: 'var(--color-gray-700)',
                        fontSize: '0.9375rem',
                        fontWeight: 500,
                        fontFamily: 'var(--font-primary)',
                        cursor: 'pointer',
                        minHeight: 44,
                      }}
                    >
                      Load More
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </PageContainer>
    </AppShell>
  )
}
