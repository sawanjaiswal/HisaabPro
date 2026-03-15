/** Party Statement Page — per-party transaction ledger with running balance (lazy loaded) */

import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Phone, User } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { usePartyStatement } from './hooks/usePartyStatement'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import { STATEMENT_TYPE_LABELS, STATEMENT_TYPE_COLORS } from './report.constants'
import { exportReport } from './report.service'
import { formatAmount, formatReportDate } from './report.utils'
import type { ExportFormat } from './report.types'
import type { StatementTransaction } from './report.types'
import './reports.css'

// ─── Transaction Row ───────────────────────────────────────────────────────────

interface StatementRowProps {
  txn: StatementTransaction
  onNavigate: (referenceId: string, type: StatementTransaction['type']) => void
}

function StatementRow({ txn, onNavigate }: StatementRowProps) {
  const typeColor = STATEMENT_TYPE_COLORS[txn.type]
  const isReceivable = txn.runningBalance >= 0

  return (
    <div
      className="report-statement-row"
      role="listitem"
      onClick={() => onNavigate(txn.referenceId, txn.type)}
      style={{ cursor: 'pointer' }}
      aria-label={`${STATEMENT_TYPE_LABELS[txn.type]}: ${txn.description}`}
    >
      <div
        className="report-statement-type-dot"
        style={{ background: typeColor }}
        aria-hidden="true"
      />
      <div className="report-statement-meta">
        <div className="report-statement-description">{txn.description}</div>
        <div
          className="report-statement-reference"
          style={{ color: typeColor }}
        >
          {STATEMENT_TYPE_LABELS[txn.type]} · {txn.reference}
        </div>
        <div className="report-statement-date">{formatReportDate(txn.date)}</div>
      </div>
      <div className="report-statement-amounts">
        {txn.debit > 0 ? (
          <span className="report-statement-debit">{formatAmount(txn.debit)}</span>
        ) : (
          <span className="report-statement-debit" style={{ opacity: 0.3 }}>—</span>
        )}
        {txn.credit > 0 ? (
          <span className="report-statement-credit">{formatAmount(txn.credit)}</span>
        ) : (
          <span className="report-statement-credit" style={{ opacity: 0.3 }}>—</span>
        )}
        <span
          className={`report-statement-balance ${
            isReceivable
              ? 'report-statement-balance--receivable'
              : 'report-statement-balance--payable'
          }`}
        >
          {formatAmount(Math.abs(txn.runningBalance))}
        </span>
      </div>
      <div className="report-divider" />
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PartyStatementPage() {
  const { partyId = '' } = useParams<{ partyId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const { data, status, loadMore, refresh } = usePartyStatement(partyId)

  const party = data?.data.party
  const statement = data?.data
  const hasMore = data?.meta.hasMore ?? false

  const handleNavigateToDoc = useCallback(
    (referenceId: string, type: StatementTransaction['type']) => {
      if (type === 'sale_invoice' || type === 'purchase_invoice') {
        navigate(ROUTES.INVOICE_DETAIL.replace(':id', referenceId))
      } else if (type === 'payment_received' || type === 'payment_made') {
        navigate(ROUTES.PAYMENT_DETAIL.replace(':id', referenceId))
      }
    },
    [navigate],
  )

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!statement) return
      try {
        await exportReport({
          reportType: 'party_statement',
          format,
          filters: { partyId },
        })
        toast.success(`Statement exported as ${format.toUpperCase()}`)
      } catch {
        toast.error('Export failed. Please try again.')
      }
    },
    [statement, partyId, toast],
  )

  const pageTitle = party ? `${party.name} Statement` : 'Party Statement'

  return (
    <AppShell>
      <Header title={pageTitle} backTo={ROUTES.REPORTS} />

      <PageContainer>
        {/* Loading */}
        {status === 'loading' && <ReportSkeleton rows={6} />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title="Could not load statement"
            message="Failed to fetch the party ledger. Please try again."
            onRetry={refresh}
          />
        )}

        {/* Success */}
        {status === 'success' && statement && party && (
          <>
            {/* Party header card */}
            <div className="report-summary-bar" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="report-summary-item" style={{ flex: 2 }}>
                <span className="report-summary-label">
                  <User size={12} aria-hidden="true" style={{ display: 'inline', marginRight: 4 }} />
                  {party.type === 'customer' ? 'Customer' : 'Supplier'}
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
                <span className="report-summary-label">Opening</span>
                <span
                  className={`report-summary-value ${
                    statement.openingBalance.type === 'receivable'
                      ? 'report-summary-value--positive'
                      : 'report-summary-value--negative'
                  }`}
                >
                  {formatAmount(statement.openingBalance.amount)}
                </span>
                <span className="report-summary-count">
                  {statement.openingBalance.type === 'receivable' ? 'Receivable' : 'Payable'}
                </span>
              </div>

              {/* Closing balance */}
              <div className="report-summary-item">
                <span className="report-summary-label">Closing</span>
                <span
                  className={`report-summary-value ${
                    statement.closingBalance.type === 'receivable'
                      ? 'report-summary-value--positive'
                      : 'report-summary-value--negative'
                  }`}
                >
                  {formatAmount(statement.closingBalance.amount)}
                </span>
                <span className="report-summary-count">
                  {statement.closingBalance.type === 'receivable' ? 'Receivable' : 'Payable'}
                </span>
              </div>
            </div>

            {/* Totals bar */}
            <div className="report-summary-bar" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="report-summary-item">
                <span className="report-summary-label">Total Debit</span>
                <span className="report-summary-value report-summary-value--negative">
                  {formatAmount(statement.totals.totalDebit)}
                </span>
              </div>
              <div className="report-summary-item">
                <span className="report-summary-label">Total Credit</span>
                <span className="report-summary-value report-summary-value--positive">
                  {formatAmount(statement.totals.totalCredit)}
                </span>
              </div>
            </div>

            {/* Transaction list */}
            {statement.transactions.length === 0 ? (
              <div className="report-empty" role="status">
                <div className="report-empty-icon" aria-hidden="true">
                  <FileText size={28} />
                </div>
                <p className="report-empty-title">No transactions yet</p>
                <p className="report-empty-desc">
                  No transactions with {party.name} yet.
                </p>
                <button
                  className="btn btn-primary btn-md"
                  type="button"
                  onClick={() => navigate(ROUTES.INVOICE_CREATE)}
                  aria-label="Create an invoice"
                >
                  Create Invoice
                </button>
              </div>
            ) : (
              <div
                className="report-card-list"
                role="list"
                aria-label={`Transactions for ${party.name}`}
              >
                {statement.transactions.map((txn) => (
                  <StatementRow
                    key={txn.id}
                    txn={txn}
                    onNavigate={handleNavigateToDoc}
                  />
                ))}
              </div>
            )}

            <ReportLoadMore
              hasMore={hasMore}
              isLoading={false}
              onLoadMore={loadMore}
            />

            <ReportExportBar
              onExport={handleExport}
              disabled={statement.transactions.length === 0}
            />
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
