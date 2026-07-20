/** Purchases — List Page (lazy loaded), mockup #11.
 *
 * Archetype A over the shared document list, locked to PURCHASE_INVOICE:
 * search → segments → month-grouped rows → totals + sparkline footer.
 * Rows, groups and footer are the same primitives the sales list (#1) uses,
 * so the two screens stay identical apart from their direction.
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ShoppingCart } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FilterChips, type FilterChipOption } from '@/components/ui/FilterChips'
import { PeriodGroup } from '@/components/ui/PeriodGroup'
import { ListTotalsFooter } from '@/components/ui/ListTotalsFooter'
import { useLanguage } from '@/hooks/useLanguage'
import { useInvoices } from '@/features/invoices/useInvoices'
import { InvoiceCard } from '@/features/invoices/components/InvoiceCard'
import { InvoiceListSkeleton } from '@/features/invoices/components/InvoiceListSkeleton'
import { groupByPeriod, toPeriodTotalsSeries } from '@/lib/period-groups.utils'
import { ROUTES } from '@/config/routes.config'
import { usePurchaseFilters, type PurchaseFilter } from './usePurchaseFilters'
import '@/features/invoices/invoice-list-items.css'

export default function PurchasesPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const { data, status, filters, setSearch, setFilter: setQueryFilter, refresh } = useInvoices({
    type: 'PURCHASE_INVOICE',
  })
  const { filter, setFilter, visible } = usePurchaseFilters(setQueryFilter)

  const documents = useMemo(() => visible(data?.documents ?? []), [visible, data?.documents])

  // Purchases arrive in batches, so months — not days — are the useful period.
  const groups = useMemo(
    () => groupByPeriod(documents, (d) => d.documentDate, (d) => d.grandTotal, 'month'),
    [documents],
  )
  const series = useMemo(() => toPeriodTotalsSeries(groups), [groups])

  const chips: FilterChipOption<PurchaseFilter>[] = [
    { value: 'ALL', label: t.all },
    { value: 'THIS_MONTH', label: t.thisMonth },
    { value: 'PENDING', label: t.pending },
    { value: 'PAID', label: t.paid },
  ]

  const goToCreate = () => navigate(ROUTES.PURCHASE_NEW)
  const hasAny = status === 'success' && (data?.documents.length ?? 0) > 0

  return (
    <AppShell>
      <Header
        title={t.purchasesTitle}
        backTo={ROUTES.MORE}
        actions={
          <Button variant="ghost" size="sm" onClick={goToCreate} aria-label={t.createPurchaseAriaLabel}>
            <Plus size={20} aria-hidden="true" />
          </Button>
        }
      />

      <PageContainer variant="list" className="space-y-6">
        <div className="search-bar">
          <Search size={18} aria-hidden="true" />
          <Input
            type="search"
            value={filters.search ?? ''}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchByPartyOrNumber}
            aria-label={t.purchasesTitle}
          />
        </div>

        <FilterChips options={chips} value={filter} onChange={setFilter} label={t.purchasesTitle} />

        {/* Loading */}
        {status === 'loading' && <InvoiceListSkeleton />}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadInvoices}
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
                icon={<ShoppingCart size={40} aria-hidden="true" />}
                title={t.purchasesEmpty}
                description={t.purchasesEmptyDesc}
                action={
                  <Button variant="primary" size="md" onClick={goToCreate} aria-label={t.createPurchaseAriaLabel}>
                    {t.createPurchase}
                  </Button>
                }
              />
            )
        )}

        {/* Success */}
        {status === 'success' && documents.length > 0 && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {documents.length} {documents.length === 1 ? t.purchaseFoundSingular : t.purchaseFoundPlural}
            </div>
            <h2 className="sr-only">{t.purchaseListHeading}</h2>

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
                label={t.totalPurchases}
                totalPaise={data.summary.totalAmount}
                series={series}
                splits={[
                  { label: t.paid, paise: data.summary.totalPaid, tone: 'positive' },
                  { label: t.dueLabel, paise: data.summary.totalDue, tone: 'negative' },
                ]}
              />
            )}
          </>
        )}
      </PageContainer>

      {hasAny && (
        <Button variant="none" className="fab" onClick={goToCreate} aria-label={t.createPurchaseAriaLabel}>
          <Plus size={24} aria-hidden="true" />
        </Button>
      )}
    </AppShell>
  )
}
