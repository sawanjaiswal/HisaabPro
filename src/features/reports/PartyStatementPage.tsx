/** Customer Statement — per-party ledger, mockup #47.
 *
 * Identity + tiles → chips → month-grouped rows → export bar.
 *
 * The mockup puts download AND share in the header. Download is wired to the
 * PDF export; there is no statement-share channel yet (share sends a document,
 * and a statement is a range, not a document), so only download is promoted.
 * The export bar stays below for the format choice the header cannot offer.
 */

import { useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { FilterChips } from '@/components/ui/FilterChips'
import type { FilterChipOption } from '@/components/ui/FilterChips'
import { PeriodGroup } from '@/components/ui/PeriodGroup'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { groupByPeriod } from '@/lib/period-groups.utils'
import { usePartyStatement } from './hooks/usePartyStatement'
import { ReportLoadMore } from './components/ReportLoadMore'
import { ReportExportBar } from './components/ReportExportBar'
import { ReportSkeleton } from './components/ReportSkeleton'
import { StatementRow } from './components/StatementRow'
import { StatementSummaryCards } from './components/StatementSummaryCards'
import { exportReport } from './report.service'
import { matchesStatementFilter, statementRowAmount } from './statement-view.utils'
import type { StatementViewFilter } from './statement-view.utils'
import type { ExportFormat, StatementTransaction } from './report.types'
import './report-shared.css'
import './report-cards.css'
import './report-shared-ui.css'
import './report-party-statement.css'

export default function PartyStatementPage() {
  const { t } = useLanguage()
  const { partyId = '' } = useParams<{ partyId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const { data, status, loadMore, refresh } = usePartyStatement(partyId)
  const [filter, setFilter] = useState<StatementViewFilter>('ALL')

  const party = data?.data.party
  const statement = data?.data
  const hasMore = data?.meta.hasMore ?? false

  const transactions = useMemo(
    () => (statement?.transactions ?? []).filter((txn) => matchesStatementFilter(txn, filter)),
    [statement, filter],
  )

  const groups = useMemo(
    () => groupByPeriod(transactions, (txn) => txn.date, statementRowAmount, 'month'),
    [transactions],
  )

  const chips: FilterChipOption<StatementViewFilter>[] = [
    { value: 'ALL', label: t.all },
    { value: 'INVOICES', label: t.statementInvoices },
    { value: 'PAYMENTS', label: t.statementPayments },
    { value: 'RETURNS', label: t.statementReturns },
  ]

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
        await exportReport({ reportType: 'party_statement', format, filters: { partyId } })
        toast.success(`${t.statementExported} ${format.toUpperCase()}`)
      } catch {
        toast.error(t.exportFailed)
      }
    },
    [statement, partyId, toast, t],
  )

  const pageTitle = party ? `${party.name} ${t.statementSuffix}` : t.partyStatement

  return (
    <AppShell>
      <Header
        title={pageTitle}
        backTo={ROUTES.REPORTS}
        actions={
          <Button
            variant="ghost" size="sm"
            onClick={() => handleExport('PDF')}
            disabled={!statement}
            aria-label={t.download}
          >
            <Download size={20} aria-hidden="true" />
          </Button>
        }
      />

      <PageContainer variant="list" className="space-y-6">
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

            <FilterChips
              options={chips}
              value={filter}
              onChange={setFilter}
              label={t.partyStatement}
            />

            {/* Empty */}
            {transactions.length === 0 ? (
              <EmptyState
                icon={<FileText size={40} aria-hidden="true" />}
                title={t.noTransactionsYet}
                description={`${t.noTransactionsWith} ${party.name} ${t.yet}`}
                action={
                  <Button
                    variant="primary" size="md"
                    type="button"
                    onClick={() => navigate(ROUTES.INVOICE_CREATE)}
                  >
                    {t.createAnInvoice}
                  </Button>
                }
              />
            ) : (
              <div
                className="space-y-6"
                role="list"
                aria-label={`${t.transactionsFor} ${party.name}`}
              >
                {groups.map((group) => (
                  <PeriodGroup key={group.key} group={group}>
                    {group.items.map((txn) => (
                      <StatementRow key={txn.id} txn={txn} onNavigate={handleNavigateToDoc} />
                    ))}
                  </PeriodGroup>
                ))}
              </div>
            )}

            <ReportLoadMore hasMore={hasMore} isLoading={false} onLoadMore={loadMore} />

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
