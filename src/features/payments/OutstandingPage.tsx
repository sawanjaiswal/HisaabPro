/** Outstanding — receivable/payable summary, aging chart, party list. */

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { BulkActionBar, type BulkAction } from '@/components/ui/BulkActionBar'
import { useBulkSelect } from '@/hooks/useBulkSelect'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useOutstanding } from './useOutstanding'
import { OutstandingTotalCard } from './components/OutstandingTotalCard'
import { OutstandingFilterBar } from './components/OutstandingFilterBar'
import { OutstandingPartyList } from './components/OutstandingPartyList'
import { OutstandingSkeleton } from './components/OutstandingSkeleton'
import { ReminderDrawer } from './components/ReminderDrawer'
import { AgingChart } from './components/AgingChart'
import { sendBulkReminders } from './reminder.service'
import type { OutstandingType, OutstandingSortBy, OutstandingParty } from './payment.types'
import './outstanding-page.css'
import './outstanding-card.css'
import './outstanding-filter.css'
import './outstanding-skeleton.css'

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

  const totals = data?.totals
  const totalPaise =
    filters.type === 'PAYABLE' ? (totals?.totalPayable ?? 0)
    : filters.type === 'RECEIVABLE' ? (totals?.totalReceivable ?? 0)
    : (totals?.net ?? 0)
  const totalLabel =
    filters.type === 'PAYABLE' ? t.payable
    : filters.type === 'RECEIVABLE' ? t.totalOutstandingLabel
    : t.net

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
        {/* Total outstanding for the direction currently filtered (mockup #17) */}
        {status === 'success' && data && (
          <OutstandingTotalCard
            label={totalLabel}
            totalPaise={totalPaise}
            partyCount={data.pagination.total}
          />
        )}

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
          <OutstandingPartyList
            parties={data.parties}
            isBulkActive={bulk.isActive}
            isSelected={bulk.isSelected}
            onToggleSelect={bulk.toggle}
            onOpenParty={handleRemind}
          />
        )}

        {/* Mockup #17 footer — the full party book, not just the ones who owe */}
        {status === 'success' && data && data.parties.length > 0 && (
          <Button
            variant="outline"
            size="md"
            className="w-full"
            onClick={() => navigate(ROUTES.PARTIES)}
          >
            {t.viewAllCustomers}
          </Button>
        )}

        {/* Reminder drawer */}
        <ReminderDrawer
          open={reminderTarget !== null}
          onClose={() => setReminderTarget(null)}
          partyName={reminderTarget?.partyName ?? ''}
          partyPhone={reminderTarget?.partyPhone ?? ''}
          outstanding={reminderTarget?.outstanding ?? 0}
          onRecordPayment={
            reminderTarget ? () => handleRecordPayment(reminderTarget.partyId) : undefined
          }
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

