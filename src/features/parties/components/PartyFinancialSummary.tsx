/** Party financial summary — Outstanding and the last payment as two calm
 *  divided tiles on one horizontal line above the detail tabs. Wording is
 *  direction-aware (a supplier reads "Total Payable"); amounts are paise and
 *  come from the server-derived payload.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { SummaryTiles } from '@/components/ui/SummaryTiles'
import type { PartyDetail } from '../party.types'
import { formatAmount } from '../party.utils'

interface PartyFinancialSummaryProps {
  party: PartyDetail
}

export const PartyFinancialSummary: React.FC<PartyFinancialSummaryProps> = ({ party }) => {
  const { t } = useLanguage()
  const isSupplier = party.type === 'SUPPLIER'
  const due = Math.max(party.outstandingBalance, 0)
  const last = party.stats?.lastPayment ?? null

  return (
    <SummaryTiles
      variant="divided"
      aria-label={t.financialSummary}
      tiles={[
        {
          id: 'due',
          label: isSupplier ? t.totalPayable : t.outstanding,
          value: formatAmount(due),
          tone: 'due',
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
