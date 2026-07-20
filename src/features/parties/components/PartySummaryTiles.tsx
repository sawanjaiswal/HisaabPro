/** Party summary tiles — Outstanding / Sales (MTD) / Last Payment row.
 *
 * Matches the Customer Details mockup: three tinted stat tiles, each with a
 * value and a subtitle hint (Overdue flag, invoice count, last-payment date +
 * mode). Subtitle data comes from the server-derived `party.stats`; when it is
 * absent (stale offline cache) the hints degrade gracefully. Amounts are paise.
 */

import React from 'react'
import { ArrowDownRight, TrendingUp, Wallet } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { SummaryTiles } from '@/components/ui/SummaryTiles'
import { PAYMENT_MODE_LABELS } from '@/features/payments/payment-labels.constants'
import type { PaymentMode } from '@/features/payments/payment.types'
import type { PartyDetail } from '../party.types'
import { formatAmount } from '../party.utils'

interface PartySummaryTilesProps {
  party: PartyDetail
}

/** "10 May 2025" — short Indian date for the last-payment hint. */
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const PartySummaryTiles: React.FC<PartySummaryTilesProps> = ({ party }) => {
  const { t } = useLanguage()
  const stats = party.stats
  const due = Math.max(party.outstandingBalance, 0)

  // Sales value: MTD when stats are present, else fall back to lifetime total.
  const salesValue = stats ? stats.salesMtd : party.totalBusiness
  const salesLabel = stats ? t.salesMtd : t.totalSales
  const salesHint = stats ? `${stats.invoiceCountMtd} ${t.invoices}` : undefined

  const last = stats?.lastPayment ?? null
  const lastHint = last
    ? `${formatShortDate(last.date)} (${PAYMENT_MODE_LABELS[last.mode as PaymentMode] ?? last.mode})`
    : undefined

  return (
    <SummaryTiles
      aria-label={t.partyOverview}
      tiles={[
        {
          id: 'due',
          label: t.outstanding,
          value: formatAmount(due),
          tone: 'due',
          icon: <ArrowDownRight className="w-4 h-4" />,
          hint: stats?.isOverdue ? t.overdue : undefined,
          hintTone: 'due',
        },
        {
          id: 'sales',
          label: salesLabel,
          value: formatAmount(salesValue),
          tone: 'sales',
          icon: <TrendingUp className="w-4 h-4" />,
          hint: salesHint,
        },
        {
          id: 'last-payment',
          label: t.lastPayment,
          value: last ? formatAmount(last.amount) : '—',
          tone: 'info',
          icon: <Wallet className="w-4 h-4" />,
          hint: lastHint,
        },
      ]}
    />
  )
}
