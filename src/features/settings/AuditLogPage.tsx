import React, { useMemo } from 'react'
import { ClipboardList } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
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

function formatDateGroupLabel(iso: string, t: Record<string, string>): string {
  const date = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (entryDay.getTime() === today.getTime()) return t.todayLabel
  if (entryDay.getTime() === yesterday.getTime()) return t.yesterdayLabel

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
  const { t } = useLanguage()
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
          label: formatDateGroupLabel(entry.createdAt, t),
          dateKey: key,
          entryIds: [],
        })
      }
      groupMap.get(key)!.entryIds.push(entry.id)
    }

    return Array.from(groupMap.values())
  }, [data, t])

  const entryById = useMemo(() => {
    if (!data) return new Map()
    return new Map(data.entries.map((e) => [e.id, e]))
  }, [data])

  const hasMore = data !== null
    ? data.pagination.page * data.pagination.limit < data.pagination.total
    : false

  return (
    <AppShell>
      <Header title={t.auditLog} backTo={ROUTES.SETTINGS} />
      <PageContainer className="audit-page space-y-6">

        <div>
          <p className="settings-section-title py-0">
            {t.actionFilterLabel}
          </p>
          <div className="audit-filters stagger-filters" role="group" aria-label={t.filterByAction}>
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
          <p className="settings-section-title py-0">
            {t.entityFilterLabel}
          </p>
          <div className="audit-filters stagger-filters" role="group" aria-label={t.filterByEntityType}>
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
          <div className="audit-list" aria-busy="true" aria-label={t.loadingAuditLog}>
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
            title={t.couldNotLoadAuditLog}
            message={t.checkConnectionRetry2}
            onRetry={refresh}
          />
        )}

        {status === 'success' && data !== null && (
          <>
            {data.entries.length === 0 ? (
              <EmptyState
                icon={<ClipboardList size={48} aria-hidden="true" />}
                title={t.noAuditEntries}
                description={t.auditEmptyDesc}
              />
            ) : (
              <div className="audit-list stagger-list">
                {dateGroups.map((group) => (
                  <React.Fragment key={group.dateKey}>
                    <div className="audit-date-group" aria-label={`${t.entriesFrom} ${group.label}`}>
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
                      className="py-0"
                    >
                      {t.loadMoreBtn}
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
