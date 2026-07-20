/** Customer Statement header — identity card + three tiles (mockup #47).
 *
 * The mockup's tiles read Total Outstanding / Paid Till Date / Total Sales.
 * Only the first is a stored balance; the other two are the statement's own
 * credit and debit totals, which is what "paid" and "billed" mean on a ledger.
 * They are labelled that way rather than invented elsewhere.
 *
 * Opening balance is not in the mockup but stays: without it the rows below
 * do not reconcile to the outstanding figure above them.
 */

import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { SummaryTiles } from '@/components/ui/SummaryTiles'
import type { SummaryTile } from '@/components/ui/SummaryTiles'
import { useLanguage } from '@/hooks/useLanguage'
import { formatAmount } from '../report.utils'
import type { PartyStatementData } from '../report.types'

export interface StatementSummaryCardsProps {
  party: PartyStatementData['party']
  openingBalance: PartyStatementData['openingBalance']
  closingBalance: PartyStatementData['closingBalance']
  totals: PartyStatementData['totals']
}

export function StatementSummaryCards({
  party,
  openingBalance,
  closingBalance,
  totals,
}: StatementSummaryCardsProps) {
  const { t } = useLanguage()

  const tiles: SummaryTile[] = [
    {
      id: 'outstanding',
      label: t.totalOutstanding,
      value: formatAmount(Math.abs(closingBalance.amount)),
      tone: 'due',
      hint: closingBalance.type === 'receivable' ? t.receivable : t.payable,
    },
    {
      id: 'paid',
      label: t.paidTillDate,
      value: formatAmount(totals.totalCredit),
      tone: 'paid',
    },
    {
      id: 'billed',
      label: party.type === 'customer' ? t.totalSales : t.totalPurchases,
      value: formatAmount(totals.totalDebit),
      tone: 'neutral',
    },
  ]

  return (
    <div className="statement-header">
      <div className="statement-identity">
        <PartyAvatar name={party.name} size="md" />
        <div className="statement-identity__main">
          <div className="statement-identity__name">{party.name}</div>
          <div className="statement-identity__meta">
            {party.type === 'customer' ? t.customer : t.supplier}
            {party.phone ? ` · ${party.phone}` : ''}
          </div>
        </div>
      </div>

      <div className="statement-opening">
        <span className="statement-opening__label">{t.opening}</span>
        <span className="statement-opening__value tabular-nums">
          {formatAmount(Math.abs(openingBalance.amount))}
        </span>
      </div>

      <SummaryTiles tiles={tiles} aria-label={t.partyStatement} />
    </div>
  )
}
