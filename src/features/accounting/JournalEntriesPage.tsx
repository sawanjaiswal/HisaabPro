/** Journal Entries — Paginated list with type and status filters */

import { FileText } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useJournalEntries } from './useJournalEntries'
import { JournalEntryCard } from './components/JournalEntryCard'
import { JOURNAL_TYPE_LABELS, ENTRY_STATUS_LABELS } from './accounting.constants'
import type { JournalEntryType, EntryStatus } from './accounting.types'
import './accounting.css'
import { useLanguage } from '@/hooks/useLanguage'

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...Object.entries(JOURNAL_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  ...Object.entries(ENTRY_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
]

export default function JournalEntriesPage() {
  const { t } = useLanguage()
  const { entries, total, status, filters, hasMore, setTypeFilter, setStatusFilter, loadMore, refresh } =
    useJournalEntries()

  if (status === 'loading' && entries.length === 0) {
    return (
      <AppShell>
        <Header title={t.journalEntries ?? "Journal Entries"} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <div className="mb-3"><Skeleton height="80px" /></div>
          <div className="mb-3"><Skeleton height="80px" /></div>
          <Skeleton height="80px" />
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error' && entries.length === 0) {
    return (
      <AppShell>
        <Header title={t.journalEntries ?? "Journal Entries"} backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadAccounts} onRetry={refresh} />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header title={t.journalEntries ?? "Journal Entries"} backTo={ROUTES.REPORTS} />
      <PageContainer>
        {/* Filters */}
        <div className="je-filters stagger-filters">
          <div className="pill-tabs">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`pill-tab${filters.type === (opt.value || undefined) ? ' active' : ''}`}
                onClick={() => setTypeFilter(opt.value ? (opt.value as JournalEntryType) : undefined)}
                aria-label={`Filter by ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="pill-tabs" style={{ marginTop: 'var(--space-2)' }}>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`pill-tab${filters.status === (opt.value || undefined) ? ' active' : ''}`}
                onClick={() => setStatusFilter(opt.value ? (opt.value as EntryStatus) : undefined)}
                aria-label={`Filter by status ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        {status === 'success' && (
          <p className="je-count" aria-live="polite">
            {total} {total === 1 ? 'entry' : 'entries'}
          </p>
        )}

        {/* Empty */}
        {status === 'success' && entries.length === 0 && (
          <EmptyState
            icon={<FileText size={28} aria-hidden="true" />}
            title={t.noJournalEntries}
            description={t.journalEntriesAutoDesc}
          />
        )}

        {/* List */}
        {entries.length > 0 && (
          <ul className="je-list stagger-list" role="list" aria-label={t.journalEntries ?? "Journal Entries"}>
            {entries.map((entry) => (
              <JournalEntryCard key={entry.id} entry={entry} />
            ))}
          </ul>
        )}

        {/* Load more */}
        {hasMore && (
          <button
            type="button"
            className="btn btn-secondary btn-md je-load-more"
            onClick={loadMore}
            disabled={status === 'loading'}
            aria-label={t.loadMoreJournalEntries}
          >
            {status === 'loading' ? t.loading : t.loadMoreJournalEntries}
          </button>
        )}
      </PageContainer>
    </AppShell>
  )
}
