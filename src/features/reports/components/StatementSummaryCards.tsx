/** Party header card + totals bar for the party statement page */

import { Phone, User } from 'lucide-react'
import { formatAmount } from '../report.utils'
import type { PartyStatementData } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

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
    return (
    <>
      {/* Party header card */}
      <div className="report-summary-bar" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="report-summary-item" style={{ flex: 2 }}>
          <span className="report-summary-label">
            <User size={12} aria-hidden="true" style={{ display: 'inline', marginRight: 4 }} />
            {party.type === 'customer' ? t.customer : t.supplier}
          </span>
          <span className="report-summary-value">{party.name}</span>
          {party.phone && (
            <span className="report-summary-count">
              <Phone size={11} aria-hidden="true" style={{ display: 'inline', marginRight: 2 }} />
              {party.phone}
            </span>
          )}
        </div>

        {/* Opening balance */}
        <div className="report-summary-item">
          <span className="report-summary-label">{t.opening}</span>
          <span
            className={`report-summary-value ${
              openingBalance.type === 'receivable'
                ? 'report-summary-value--positive'
                : 'report-summary-value--negative'
            }`}
          >
            {formatAmount(openingBalance.amount)}
          </span>
          <span className="report-summary-count">
            {openingBalance.type === 'receivable' ? t.receivable : t.payable}
          </span>
        </div>

        {/* Closing balance */}
        <div className="report-summary-item">
          <span className="report-summary-label">{t.closing}</span>
          <span
            className={`report-summary-value ${
              closingBalance.type === 'receivable'
                ? 'report-summary-value--positive'
                : 'report-summary-value--negative'
            }`}
          >
            {formatAmount(closingBalance.amount)}
          </span>
          <span className="report-summary-count">
            {closingBalance.type === 'receivable' ? t.receivable : t.payable}
          </span>
        </div>
      </div>

      {/* Totals bar */}
      <div className="report-summary-bar" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="report-summary-item">
          <span className="report-summary-label">{t.totalDebit}</span>
          <span className="report-summary-value report-summary-value--negative">
            {formatAmount(totals.totalDebit)}
          </span>
        </div>
        <div className="report-summary-item">
          <span className="report-summary-label">{t.totalCredit}</span>
          <span className="report-summary-value report-summary-value--positive">
            {formatAmount(totals.totalCredit)}
          </span>
        </div>
      </div>
    </>
  )
}
