/** Outstanding — receivable/payable summary, aging chart, party list. */

import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { BulkActionBar, type BulkAction } from '@/components/ui/BulkActionBar'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useOutstanding } from './useOutstanding'
import { OutstandingSummaryBar } from './components/OutstandingSummaryBar'
import { OutstandingFilterBar } from './components/OutstandingFilterBar'
import { OutstandingCard } from './components/OutstandingCard'
import { OutstandingSkeleton } from './components/OutstandingSkeleton'
import { ReminderDrawer } from './components/ReminderDrawer'
import { AgingChart } from './components/AgingChart'
import { sendBulkReminders } from './reminder.service'
import type { OutstandingType, OutstandingSortBy, OutstandingParty } from './payment.types'
import './outstanding-page.css'
import './outstanding-card.css'
import './outstanding-filter.css'
import './outstanding-skeleton.css'

const LONG_PRESS_MS = 500

export default function OutstandingPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const bulk = useBulkSelect()
  const [isSendingBulk, setIsSendingBulk] = useState(false)

  // Read initial tab from URL: ?tab=receivable|payable → maps to RECEIVABLE|PAYABLE
  const tabParam = searchParams.get('tab')?.toUpperCase()
  const initialType = tabParam === 'RECEIVABLE' || tabParam === 'PAYABLE' ? tabParam : undefined

  const { data, status, filters, setSearch, setFilter, refresh } = useOutstanding({
    initialFilters: initialType ? { type: initialType } : undefined,
  })

  const handleTypeChange = (type: OutstandingType) => {
    setFilter('type', type)
    // Bulk reminders are receivable-only — clear selection on type change
    if (type !== 'RECEIVABLE' && bulk.isActive) bulk.clear()
  }

  const handleOverdueToggle = (value: boolean) => {
    setFilter('overdue', value)
  }

  const handleSortChange = (sortBy: OutstandingSortBy) => {
    setFilter('sortBy', sortBy)
  }

  const [reminderTarget, setReminderTarget] = useState<OutstandingParty | null>(null)

  const handleRemind = (partyId: string) => {
    const party = data?.parties.find((p) => p.partyId === partyId) ?? null
    setReminderTarget(party)
  }

  const handleRecordPayment = (partyId: string) => {
    navigate(`${ROUTES.PAYMENT_NEW}?type=PAYMENT_IN&partyId=${partyId}`)
  }

  // Long-press → enter bulk mode (receivable only)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)

  const startLongPress = (partyId: string, party: OutstandingParty) => {
    if (party.type !== 'RECEIVABLE') return
    didLongPressRef.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPressRef.current = true
      bulk.toggle(partyId)
    }, LONG_PRESS_MS)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleCardClick = (partyId: string, party: OutstandingParty) => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false
      return
    }
    if (bulk.isActive) {
      if (party.type === 'RECEIVABLE') bulk.toggle(partyId)
      return
    }
    // Default: open the per-party reminder drawer
    handleRemind(partyId)
  }

  const selectableIds = (data?.parties ?? [])
    .filter((p) => p.type === 'RECEIVABLE')
    .map((p) => p.partyId)

  const handleBulkRemind = async () => {
    const ids = Array.from(bulk.selectedIds)
    if (ids.length === 0) return
    setIsSendingBulk(true)
    try {
      const result = await sendBulkReminders({ partyIds: ids, channel: 'WHATSAPP' })
      const sentLabel = result.sent === 1 ? t.reminderSentCount : t.remindersSentCount
      const msg = result.failed > 0
        ? `${result.sent} ${sentLabel}, ${result.failed} ${t.remindersFailedCount}`
        : `${result.sent} ${sentLabel}`
      if (result.failed > 0 && result.sent === 0) toast.error(msg)
      else toast.success(msg)
      bulk.clear()
      refresh()
    } catch {
      toast.error(t.failedSendReminders)
    } finally {
      setIsSendingBulk(false)
    }
  }

  const bulkActions: BulkAction[] = [
    {
      id: 'remind',
      label: t.sendBulkReminders,
      icon: 'share',
      onClick: handleBulkRemind,
    },
  ]

  return (
    <AppShell>
      <Header
        title={bulk.isActive ? `${bulk.selectedCount} ${t.selected}` : t.outstandingTitle}
        backTo={ROUTES.DASHBOARD}
      />

      <PageContainer variant="list" className="space-y-6">
        {/* Summary cards */}
        {status === 'success' && data && <OutstandingSummaryBar totals={data.totals} />}

        {/* Aging chart */}
        {status === 'success' && data && data.aging && (
          <AgingChart aging={data.aging} />
        )}

        {/* Filter bar */}
        <OutstandingFilterBar
          search={filters.search}
          onSearchChange={setSearch}
          activeType={filters.type}
          onTypeChange={handleTypeChange}
          overdueOnly={filters.overdue}
          onOverdueToggle={handleOverdueToggle}
          sortBy={filters.sortBy}
          onSortChange={handleSortChange}
        />

        {/* Loading */}
        {status === 'loading' && <OutstandingSkeleton />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadOutstanding}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {/* Empty */}
        {status === 'success' && data && data.parties.length === 0 && (
          <EmptyState
            icon={<Banknote size={40} aria-hidden="true" />}
            title={t.allClearNoOutstanding}
            description={t.outstandingEmptyDesc}
          />
        )}

        {/* Party list */}
        {status === 'success' && data && data.parties.length > 0 && (
          <div className="outstanding-list stagger-list" role="list" aria-label={t.outstandingPartiesList}>
            {data.parties.map((party) => {
              const selected = bulk.isSelected(party.partyId)
              const isReceivable = party.type === 'RECEIVABLE'
              return (
                <div
                  key={party.partyId}
                  role="listitem"
                  className={selected ? 'bulk-selected outstanding-list-item--selected' : 'outstanding-list-item'}
                  onPointerDown={() => startLongPress(party.partyId, party)}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  onClick={(e) => {
                    // Only intercept clicks on the wrapper itself, not on inner action buttons
                    if (bulk.isActive && isReceivable) {
                      e.stopPropagation()
                      handleCardClick(party.partyId, party)
                    }
                  }}
                  aria-selected={selected || undefined}
                  style={bulk.isActive && isReceivable ? { cursor: 'pointer' } : undefined}
                >
                  <OutstandingCard
                    party={party}
                    onRemind={handleRemind}
                    onRecordPayment={handleRecordPayment}
                  />
                </div>
              )
            })}
          </div>
        )}
        {/* Reminder drawer */}
        <ReminderDrawer
          open={reminderTarget !== null}
          onClose={() => setReminderTarget(null)}
          partyName={reminderTarget?.partyName ?? ''}
          partyPhone={reminderTarget?.partyPhone ?? ''}
          outstanding={reminderTarget?.outstanding ?? 0}
        />
      </PageContainer>

      <BulkActionBar
        selectedCount={bulk.selectedCount}
        totalCount={selectableIds.length}
        onSelectAll={() => bulk.selectAll(selectableIds)}
        onClear={bulk.clear}
        actions={bulkActions}
        isProcessing={isSendingBulk}
      />
    </AppShell>
  )
}

