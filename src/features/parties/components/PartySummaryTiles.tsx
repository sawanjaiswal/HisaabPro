/** Party summary tiles — four divider-separated stats above the detail tabs.
 *
 * Wording follows the party's direction: a customer reads Outstanding /
 * Oldest Due / Open Invoices / Last Payment, a supplier reads Total Payable
 * for the first column (mockup #52 — Supplier Ledger). The numbers behind
 * them are already direction-aware — see server detail-stats.ts.
 *
 * Stat data comes from the server-derived `party.stats`; when it is absent
 * (stale offline cache) the derived columns fall back to "—" rather than
 * showing a confident zero. Amounts are paise.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { SummaryTiles } from '@/components/ui/SummaryTiles'
import { PAYMENT_MODE_LABELS } from '@/features/payments/payment-labels.constants'
import type { PaymentMode } from '@/features/payments/payment.types'
import type { PartyDetail } from '../party.types'
import { formatAmount } from '../party.utils'

interface PartySummaryTilesProps {
  party: PartyDetail
}

/** "10 May" — short Indian date for the last-payment hint. The year is dropped
 *  because the divided strip gives each column roughly a quarter of 375px. */
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export const PartySummaryTiles: React.FC<PartySummaryTilesProps> = ({ party }) => {
  const { t } = useLanguage()
  const stats = party.stats
  const due = Math.max(party.outstandingBalance, 0)
  const isSupplier = party.type === 'SUPPLIER'

  const last = stats?.lastPayment ?? null
  const lastHint = last
    ? `${formatShortDate(last.date)} (${PAYMENT_MODE_LABELS[last.mode as PaymentMode] ?? last.mode})`
    : undefined

  return (
    <SummaryTiles
      variant="divided"
      aria-label={t.partyOverview}
      tiles={[
        {
          id: 'due',
          label: isSupplier ? t.totalPayable : t.outstanding,
          value: formatAmount(due),
          tone: 'due',
        },
        {
          id: 'oldest-due',
          label: t.oldestDue,
          // 0 days is a real answer only when something IS overdue; with no
          // overdue invoice at all the honest reading is "nothing", not "0 days".
          value: stats?.isOverdue ? `${stats.oldestDueDays}` : '—',
          tone: stats?.isOverdue ? 'due' : 'neutral',
          hint: stats?.isOverdue ? t.days : undefined,
          hintTone: 'due',
        },
        {
          id: 'open-invoices',
          label: t.openInvoices,
          value: stats ? `${stats.openInvoiceCount}` : '—',
          tone: 'neutral',
          hint: stats ? t.invoicesCount : undefined,
        },
        {
          id: 'last-payment',
          label: t.lastPayment,
          value: last ? formatAmount(last.amount) : '—',
          tone: 'paid',
          hint: lastHint,
        },
      ]}
    />
  )
}
