/** Public Ledger View — Read-only ledger displayed to share recipients */

import type { PublicLedgerData } from '../shared-ledger.types'

interface PublicLedgerViewProps {
  data: PublicLedgerData
}

export function PublicLedgerView({ data }: PublicLedgerViewProps) {
  const formatAmount = (paise: number) =>
    `Rs ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div className="public-ledger">
      <div className="public-ledger-header">
        <h1 className="public-ledger-business">{data.businessName}</h1>
        <p className="public-ledger-party">Ledger for {data.partyName}</p>
        <span className="public-ledger-badge">Read-only view</span>
      </div>

      {/* Summary */}
      <div className="public-ledger-summary">
        <div className="public-ledger-stat">
          <span className="public-ledger-stat-label">Total Debit</span>
          <span className="public-ledger-stat-value">{formatAmount(data.totalDebit)}</span>
        </div>
        <div className="public-ledger-stat">
          <span className="public-ledger-stat-label">Total Credit</span>
          <span className="public-ledger-stat-value">{formatAmount(data.totalCredit)}</span>
        </div>
        <div className="public-ledger-stat">
          <span className="public-ledger-stat-label">Balance</span>
          <span className="public-ledger-stat-value public-ledger-stat-balance">
            {formatAmount(data.closingBalance)}
          </span>
        </div>
      </div>

      {/* Transactions */}
      <div className="public-ledger-table" role="table" aria-label="Transaction history">
        <div className="public-ledger-table-head" role="row">
          <span role="columnheader">Date</span>
          <span role="columnheader">Description</span>
          <span role="columnheader">Debit</span>
          <span role="columnheader">Credit</span>
          <span role="columnheader">Balance</span>
        </div>
        {data.transactions.map((tx, i) => (
          <div key={`${tx.date}-${tx.reference}-${i}`} className="public-ledger-table-row" role="row">
            <span role="cell">{new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
            <span role="cell" className="public-ledger-desc">
              <span>{tx.description}</span>
              {tx.reference && <small>{tx.reference}</small>}
            </span>
            <span role="cell">{tx.debit ? formatAmount(tx.debit) : '—'}</span>
            <span role="cell">{tx.credit ? formatAmount(tx.credit) : '—'}</span>
            <span role="cell">{formatAmount(tx.runningBalance)}</span>
          </div>
        ))}
      </div>

      <p className="public-ledger-watermark">
        Shared via HisaabPro on {new Date(data.generatedAt).toLocaleDateString('en-IN')}
      </p>
    </div>
  )
}
