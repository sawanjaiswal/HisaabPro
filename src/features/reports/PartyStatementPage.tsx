/** Party Statement Page — per-party transaction ledger with running balance (lazy loaded) */

import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
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
import { StatementRow } from './components/StatementRow'
import { StatementSummaryCards } from './components/StatementSummaryCards'
import { exportReport } from './report.service'
import type { ExportFormat } from './report.types'
import type { StatementTransaction } from './report.types'
import './report-shared.css'
import './report-cards.css'
import './report-shared-ui.css'
import './report-party-statement.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function PartyStatementPage() {
  const { t } = useLanguage()
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
        toast.success(`${t.statementExported} ${format.toUpperCase()}`)
      } catch {
        toast.error(t.exportFailed)
      }
    },
    [statement, partyId, toast],
  )

  const pageTitle = party ? `${party.name} ${t.statementSuffix}` : t.partyStatement

  return (
    <AppShell>
      <Header title={pageTitle} backTo={ROUTES.REPORTS} />

      <PageContainer>
        {/* Loading */}
        {status === 'loading' && <ReportSkeleton rows={6} />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadStatement}
            message={t.failedFetchPartyLedger}
            onRetry={refresh}
          />
        )}

        {/* Success */}
        {status === 'success' && statement && party && (
          <>
            <StatementSummaryCards
              party={party}
              openingBalance={statement.openingBalance}
              closingBalance={statement.closingBalance}
              totals={statement.totals}
            />

            {/* Transaction list */}
            {statement.transactions.length === 0 ? (
              <div className="report-empty" role="status">
                <div className="report-empty-icon" aria-hidden="true">
                  <FileText size={28} />
                </div>
                <p className="report-empty-title">{t.noTransactionsYet}</p>
                <p className="report-empty-desc">
                  {`${t.noTransactionsWith} ${party.name} ${t.yet}`}
                </p>
                <button
                  className="btn btn-primary btn-md"
                  type="button"
                  onClick={() => navigate(ROUTES.INVOICE_CREATE)}
                  aria-label={t.createAnInvoice}
                >
                  Create Invoice
                </button>
              </div>
            ) : (
              <div
                className="report-card-list"
                role="list"
                aria-label={`${t.transactionsFor} ${party.name}`}
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
