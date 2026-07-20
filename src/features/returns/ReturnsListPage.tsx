/** Returns — List Page (lazy loaded), mockups #44 (sales) and #51 (purchase).
 *
 * Both mockups are the same screen over a different document type, so one
 * component serves both: search → segments → month-grouped rows → totals
 * footer, on the same primitives the sales (#1) and purchase (#11) lists use.
 *
 * The mockups label rows "Approved" / "Pending". This app has no approval
 * workflow on returns — a credit/debit note is either settled against the
 * original bill or still outstanding — so the rows carry the settlement
 * state we actually hold rather than a status we would have to invent.
 *
 * There is no create affordance yet: a return must reference the bill it
 * reverses, and no picker for that exists. It arrives with the return form.
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Undo2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Input } from '@/components/ui/Input'
import { FilterChips, type FilterChipOption } from '@/components/ui/FilterChips'
import { PeriodGroup } from '@/components/ui/PeriodGroup'
import { ListTotalsFooter } from '@/components/ui/ListTotalsFooter'
import { useLanguage } from '@/hooks/useLanguage'
import { useInvoices } from '@/features/invoices/useInvoices'
import { useDocumentSegments, type DocumentSegment } from '@/features/invoices/useDocumentSegments'
import { InvoiceCard } from '@/features/invoices/components/InvoiceCard'
import { InvoiceListSkeleton } from '@/features/invoices/components/InvoiceListSkeleton'
import { groupByPeriod, toPeriodTotalsSeries } from '@/lib/period-groups.utils'
import { ROUTES } from '@/config/routes.config'
import '@/features/invoices/invoice-list-items.css'

interface ReturnsListPageProps {
  /** CREDIT_NOTE = sales return (#44), DEBIT_NOTE = purchase return (#51). */
  type?: 'CREDIT_NOTE' | 'DEBIT_NOTE'
}

export default function ReturnsListPage({ type = 'CREDIT_NOTE' }: ReturnsListPageProps) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isSalesReturn = type === 'CREDIT_NOTE'

  const { data, status, filters, setSearch, setFilter: setQueryFilter, refresh } = useInvoices({ type })
  const { segment, setSegment, visible } = useDocumentSegments(setQueryFilter)

  const documents = useMemo(() => visible(data?.documents ?? []), [visible, data?.documents])

  // Returns are occasional, so months — not days — are the useful period.
  const groups = useMemo(
    () => groupByPeriod(documents, (d) => d.documentDate, (d) => d.grandTotal, 'month'),
    [documents],
  )
  const series = useMemo(() => toPeriodTotalsSeries(groups), [groups])

  const chips: FilterChipOption<DocumentSegment>[] = [
    { value: 'ALL', label: t.all },
    { value: 'THIS_MONTH', label: t.thisMonth },
    { value: 'PENDING', label: t.pending },
    { value: 'PAID', label: t.settled },
  ]

  const title = isSalesReturn ? t.salesReturnsTitle : t.purchaseReturnsTitle
  const hasAny = status === 'success' && (data?.documents.length ?? 0) > 0

  return (
    <AppShell>
      <Header title={title} backTo={isSalesReturn ? ROUTES.INVOICES : ROUTES.PURCHASES} />

      <PageContainer variant="list" className="space-y-6">
        <div className="search-bar">
          <Search size={18} aria-hidden="true" />
          <Input
            type="search"
            value={filters.search ?? ''}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchReturns}
            aria-label={title}
          />
        </div>

        <FilterChips options={chips} value={segment} onChange={setSegment} label={title} />

        {/* Loading */}
        {status === 'loading' && <InvoiceListSkeleton />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadReturns}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {/* Empty — nothing recorded vs nothing matching the segment */}
        {status === 'success' && documents.length === 0 && (
          hasAny || filters.search
            ? <EmptyState title={t.noResults} description={t.tryDifferentSearch} />
            : (
              <EmptyState
                icon={<Undo2 size={40} aria-hidden="true" />}
                title={isSalesReturn ? t.noSalesReturnsYet : t.noPurchaseReturnsYet}
                description={isSalesReturn ? t.noSalesReturnsYetDesc : t.noPurchaseReturnsYetDesc}
              />
            )
        )}

        {/* Success */}
        {status === 'success' && documents.length > 0 && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {documents.length} {documents.length === 1 ? t.returnFoundSingular : t.returnFoundPlural}
            </div>
            <h2 className="sr-only">{t.returnListHeading}</h2>

            {groups.map((group) => (
              <PeriodGroup key={group.key} group={group}>
                {group.items.map((doc) => (
                  <div key={doc.id} className="invoice-list-row" role="listitem">
                    <InvoiceCard
                      document={doc}
                      onClick={(id) => navigate(ROUTES.INVOICE_DETAIL.replace(':id', id))}
                      onLongPress={() => {}}
                      isSelected={false}
                      isBulkMode={false}
                    />
                    <div className="divider" aria-hidden="true" />
                  </div>
                ))}
              </PeriodGroup>
            ))}

            {data && (
              <ListTotalsFooter
                label={t.totalReturns}
                totalPaise={data.summary.totalAmount}
                series={series}
                splits={[
                  { label: t.settled, paise: data.summary.totalPaid, tone: 'positive' },
                  { label: t.pending, paise: data.summary.totalDue, tone: 'negative' },
                ]}
              />
            )}
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
