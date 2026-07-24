/** Party financial summary — one calm card (Customer Details gold-standard, D1).
 *
 * The outstanding balance is the headline; credit limit, available credit,
 * "customer since" and the last payment sit beneath a divider as quiet meta
 * rows. Replaces the older three-tile strip: fewer confident numbers, more
 * context. Values are direction-aware and come from the server-derived
 * payload; amounts are paise. Credit rows appear only when a limit is set.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Card } from '@/components/ui/Card'
import type { PartyDetail } from '../party.types'
import { formatAmount, availableCreditPaise, formatMonthYear } from '../party.utils'
import './party-financial-summary.css'

interface PartyFinancialSummaryProps {
  party: PartyDetail
}

type MetaRow = { id: string; label: string; value: string; tone?: 'good' | 'over' }

export const PartyFinancialSummary: React.FC<PartyFinancialSummaryProps> = ({ party }) => {
  const { t } = useLanguage()
  const isSupplier = party.type === 'SUPPLIER'
  const due = Math.max(party.outstandingBalance, 0)
  const hasLimit = party.creditLimit > 0
  const available = availableCreditPaise(party.creditLimit, party.outstandingBalance)
  const overLimit = hasLimit && available < 0
  const last = party.stats?.lastPayment ?? null

  const meta: MetaRow[] = []
  if (hasLimit) {
    meta.push({ id: 'limit', label: t.creditLimit, value: formatAmount(party.creditLimit) })
    meta.push({
      id: 'available',
      label: overLimit ? t.overCreditLimit : t.availableCredit,
      value: formatAmount(Math.abs(available)),
      tone: overLimit ? 'over' : 'good',
    })
  }
  meta.push({
    id: 'since',
    label: isSupplier ? t.supplierSince : t.customerSince,
    value: formatMonthYear(party.createdAt),
  })
  if (last) {
    meta.push({ id: 'last', label: t.lastPayment, value: formatAmount(last.amount) })
  }

  return (
    <Card className="pd-financial" role="group" aria-label={t.financialSummary}>
      <div className="pd-financial__head">
        <span className="pd-financial__label">{isSupplier ? t.totalPayable : t.outstanding}</span>
        <span className="pd-financial__amount tabular-nums">{formatAmount(due)}</span>
      </div>
      <dl className="pd-financial__meta">
        {meta.map((row) => (
          <div key={row.id} className="pd-financial__row">
            <dt className="pd-financial__row-label">{row.label}</dt>
            <dd
              className={`pd-financial__row-value tabular-nums${
                row.tone ? ` pd-financial__row-value--${row.tone}` : ''
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
