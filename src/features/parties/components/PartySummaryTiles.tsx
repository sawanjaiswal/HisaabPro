/** Party summary tiles — three divider-separated stats above the detail tabs.
 *
 * Wording follows the party's direction: a customer reads Outstanding /
 * Open Invoices / Last Payment, a supplier reads Total Payable
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
import type { PartyDetail } from '../party.types'
import { formatAmount } from '../party.utils'

interface PartySummaryTilesProps {
  party: PartyDetail
}

export const PartySummaryTiles: React.FC<PartySummaryTilesProps> = ({ party }) => {
  const { t } = useLanguage()
  const stats = party.stats
  const due = Math.max(party.outstandingBalance, 0)
  const isSupplier = party.type === 'SUPPLIER'

  const last = stats?.lastPayment ?? null

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
          id: 'open-invoices',
          label: t.openInvoices,
          value: stats ? `${stats.openInvoiceCount}` : '—',
          tone: 'neutral',
        },
        {
          id: 'last-payment',
          label: t.lastPayment,
          value: last ? formatAmount(last.amount) : '—',
          tone: 'paid',
        },
      ]}
    />
  )
}
