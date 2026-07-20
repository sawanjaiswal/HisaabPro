/** Draft Invoices — list page, mockup #43.
 *
 * Everything started but never saved. Tapping a row reopens it in the invoice
 * form, which is the only thing a draft is for; the trailing action deletes it.
 *
 * The mockup shows a per-row kebab. A draft has exactly two actions — resume
 * and discard — and the row itself is resume, so the kebab would hold one
 * item. It is a plain delete button instead.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Search, Trash2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ListTotalsFooter } from '@/components/ui/ListTotalsFooter'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { groupByPeriod, toPeriodTotalsSeries } from '@/lib/period-groups.utils'
import { useInvoices } from './useInvoices'
import { InvoiceListSkeleton } from './components/InvoiceListSkeleton'
import { formatInvoiceAmount, formatInvoiceDate } from './invoice-format.utils'
import './draft-invoices.css'

export default function DraftInvoicesPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { data, status, filters, setSearch, refresh, handleDelete } = useInvoices({
    initialFilters: { status: 'DRAFT' },
  })
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null)

  const documents = data?.documents ?? []

  const groups = useMemo(
    () => groupByPeriod(documents, (d) => d.documentDate, (d) => d.grandTotal, 'month'),
    [documents],
  )
  const series = useMemo(() => toPeriodTotalsSeries(groups), [groups])
  const total = useMemo(
    () => documents.reduce((sum, doc) => sum + doc.grandTotal, 0),
    [documents],
  )

  const confirmDelete = () => {
    if (pendingDelete) handleDelete(pendingDelete.id, pendingDelete.label)
    setPendingDelete(null)
  }

  return (
    <>
      <AppShell>
        <Header
          title={t.draftInvoicesTitle}
          backTo={ROUTES.INVOICES}
          actions={
            <Button
              variant="ghost" size="sm"
              onClick={() => navigate(ROUTES.INVOICE_CREATE)}
              aria-label={t.newInvoice}
            >
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
              placeholder={t.searchDraftInvoices}
              aria-label={t.draftInvoicesTitle}
            />
          </div>

          {/* Loading */}
          {status === 'loading' && <InvoiceListSkeleton />}

          {/* Error */}
          {status === 'error' && (
            <ErrorState
              title={t.couldNotLoadInvoice}
              message={t.checkConnectionRetry}
              onRetry={refresh}
            />
          )}

          {/* Empty */}
          {status === 'success' && documents.length === 0 && (
            <EmptyState
              icon={<FileText size={40} aria-hidden="true" />}
              title={t.noDraftInvoices}
              description={t.noDraftInvoicesDesc}
              action={
                <Button variant="primary" size="md" onClick={() => navigate(ROUTES.INVOICE_CREATE)}>
                  {t.newInvoice}
                </Button>
              }
            />
          )}

          {/* Success */}
          {status === 'success' && documents.length > 0 && (
            <>
              <div className="draft-list" role="list" aria-label={t.draftInvoicesTitle}>
                {documents.map((doc) => {
                  const label = doc.documentNumber || t.untitledDraft
                  return (
                    <div className="draft-row" role="listitem" key={doc.id}>
                      <Button
                        variant="none"
                        type="button"
                        className="draft-row__main"
                        onClick={() => navigate(ROUTES.INVOICE_EDIT.replace(':id', doc.id))}
                        aria-label={`${t.resumeDraft} ${label}`}
                      >
                        <span className="draft-row__icon" aria-hidden="true">
                          <FileText size={20} />
                        </span>

                        <span className="draft-row__info">
                          <span className="draft-row__number">{label}</span>
                          <span className="draft-row__meta">
                            {doc.party.name} · {formatInvoiceDate(doc.documentDate)}
                          </span>
                        </span>

                        <span className="draft-row__amount tabular-nums">
                          {formatInvoiceAmount(doc.grandTotal)}
                        </span>
                      </Button>

                      <Button
                        variant="ghost" size="sm"
                        className="draft-row__delete"
                        onClick={() => setPendingDelete({ id: doc.id, label })}
                        aria-label={`${t.delete} ${label}`}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              <ListTotalsFooter label={t.draftInvoicesTitle} totalPaise={total} series={series} />
            </>
          )}
        </PageContainer>
      </AppShell>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={t.discardDraftTitle}
        description={t.discardDraftDesc}
      />
    </>
  )
}
