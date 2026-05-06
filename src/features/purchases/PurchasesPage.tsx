/** Purchases — List Page (lazy loaded)
 *
 * Thin wrapper over the existing invoice list, locked to PURCHASE_INVOICE type.
 * 4 UI states: loading · error · empty · success.
 */

import { useNavigate } from 'react-router-dom'
import { Plus, ShoppingCart } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { useInvoices } from '@/features/invoices/useInvoices'
import { InvoiceCard } from '@/features/invoices/components/InvoiceCard'
import { InvoiceListSkeleton } from '@/features/invoices/components/InvoiceListSkeleton'
import { ROUTES } from '@/config/routes.config'
import '@/features/invoices/invoice-list-items.css'

export default function PurchasesPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const { data, status, filters, setSearch, refresh } = useInvoices({
    type: 'PURCHASE_INVOICE',
  })

  const handleDocClick = (id: string) => {
    navigate(ROUTES.INVOICE_DETAIL.replace(':id', id))
  }

  const goToCreate = () => navigate(ROUTES.PURCHASE_NEW)

  return (
    <AppShell>
      <Header title={t.purchasesTitle} backTo={ROUTES.MORE} />

      <PageContainer className="space-y-4">
        <div className="search-bar">
          <input
            type="search"
            value={filters.search ?? ''}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchByPartyOrNumber}
            aria-label={t.purchasesTitle}
            style={{ width: '100%' }}
          />
        </div>

        {status === 'loading' && <InvoiceListSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadInvoices}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && data.documents.length === 0 && (
          <EmptyState
            icon={<ShoppingCart size={40} aria-hidden="true" />}
            title={t.purchasesEmpty}
            description={t.purchasesEmptyDesc}
            action={
              <button className="btn btn-primary btn-md" onClick={goToCreate} aria-label={t.createPurchaseAriaLabel}>
                {t.createPurchase}
              </button>
            }
          />
        )}

        {status === 'success' && data && data.documents.length > 0 && (
          <>
            <div role="status" aria-live="polite" className="sr-only">
              {data.documents.length} {data.documents.length === 1 ? t.purchaseFoundSingular : t.purchaseFoundPlural}
            </div>
            <h2 className="sr-only">{t.purchaseListHeading}</h2>
            <div className="invoice-list stagger-list" role="list" aria-label={t.purchasesTitle}>
              {data.documents.map((doc) => (
                <div key={doc.id} className="invoice-list-row" role="listitem">
                  <InvoiceCard document={doc} onClick={handleDocClick} onLongPress={() => {}} isSelected={false} isBulkMode={false} />
                  <div className="divider" aria-hidden="true" />
                </div>
              ))}
            </div>
          </>
        )}
      </PageContainer>

      <button className="fab" onClick={goToCreate} aria-label={t.createPurchaseAriaLabel}>
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
