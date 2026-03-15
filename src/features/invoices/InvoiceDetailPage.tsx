/** Invoice Detail — Page (lazy loaded)
 *
 * Follows PartyDetailPage.tsx pattern: hero header card,
 * pill tabs (Overview / Items / Share), 4 UI states.
 */

import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, MoreVertical, Share2, FileText } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useInvoiceDetail } from './useInvoiceDetail'
import { InvoiceDetailHeader } from './components/InvoiceDetailHeader'
import { formatInvoiceAmount, formatInvoiceDate } from './invoice.utils'
import { DOCUMENT_TYPE_LABELS, PAYMENT_TERMS_LABELS } from './invoice.constants'
import './invoice-detail.css'

type DetailTab = 'overview' | 'items' | 'share'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'items', label: 'Items' },
  { id: 'share', label: 'Share' },
]

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const documentId = id ?? ''
  const { document, status, activeTab, setActiveTab, refresh } = useInvoiceDetail(documentId)

  const headerActions = (
    <>
      <button className="btn btn-ghost btn-sm" aria-label="Edit invoice">
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button className="btn btn-ghost btn-sm" aria-label="Share invoice">
        <Share2 size={18} aria-hidden="true" />
      </button>
      <button className="btn btn-ghost btn-sm" aria-label="More options">
        <MoreVertical size={18} aria-hidden="true" />
      </button>
    </>
  )

  return (
    <AppShell>
      <Header title="Invoice Detail" backTo={ROUTES.INVOICES} actions={headerActions} />

      <PageContainer>
        {status === 'loading' && (
          <>
            <div className="card-primary" style={{ marginBottom: 'var(--space-4)', minHeight: 160 }}>
              <Skeleton height="1.5rem" width="60%" />
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Skeleton height="1rem" width="40%" />
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Skeleton height="2.5rem" width="50%" />
              </div>
            </div>
            <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Skeleton height="5rem" borderRadius="var(--radius-lg)" count={3} />
            </div>
          </>
        )}

        {status === 'error' && (
          <ErrorState
            title="Could not load invoice"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        )}

        {status === 'success' && !document && (
          <EmptyState
            icon={<FileText size={40} aria-hidden="true" />}
            title="Invoice not found"
            description="This invoice may have been deleted."
            action={
              <button
                className="btn btn-primary btn-md"
                onClick={() => navigate(ROUTES.INVOICES)}
                aria-label="Go back to invoices list"
              >
                Back to Invoices
              </button>
            }
          />
        )}

        {status === 'success' && document && (
          <>
            <InvoiceDetailHeader document={document} />

            <div className="pill-tabs invoice-detail-tabs" role="tablist" aria-label="Invoice detail sections">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  className={`pill-tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div id={`panel-${activeTab}`} role="tabpanel" aria-label={`${activeTab} tab content`}>
              {activeTab === 'overview' && (
                <div className="card invoice-overview-card">
                  <div className="invoice-info-row">
                    <span className="invoice-info-label">Document Type</span>
                    <span className="invoice-info-value">{DOCUMENT_TYPE_LABELS[document.type]}</span>
                  </div>
                  <div className="invoice-info-row">
                    <span className="invoice-info-label">Date</span>
                    <span className="invoice-info-value">{formatInvoiceDate(document.documentDate)}</span>
                  </div>
                  {document.dueDate && (
                    <div className="invoice-info-row">
                      <span className="invoice-info-label">Due Date</span>
                      <span className="invoice-info-value">{formatInvoiceDate(document.dueDate)}</span>
                    </div>
                  )}
                  {document.paymentTerms && (
                    <div className="invoice-info-row">
                      <span className="invoice-info-label">Payment Terms</span>
                      <span className="invoice-info-value">{PAYMENT_TERMS_LABELS[document.paymentTerms]}</span>
                    </div>
                  )}
                  <div className="invoice-info-row">
                    <span className="invoice-info-label">Subtotal</span>
                    <span className="invoice-info-value">{formatInvoiceAmount(document.subtotal)}</span>
                  </div>
                  {document.totalDiscount > 0 && (
                    <div className="invoice-info-row">
                      <span className="invoice-info-label">Discount</span>
                      <span className="invoice-info-value" style={{ color: 'var(--color-error-600)' }}>
                        -{formatInvoiceAmount(document.totalDiscount)}
                      </span>
                    </div>
                  )}
                  {document.totalAdditionalCharges > 0 && (
                    <div className="invoice-info-row">
                      <span className="invoice-info-label">Charges</span>
                      <span className="invoice-info-value">+{formatInvoiceAmount(document.totalAdditionalCharges)}</span>
                    </div>
                  )}
                  {document.roundOff !== 0 && (
                    <div className="invoice-info-row">
                      <span className="invoice-info-label">Round Off</span>
                      <span className="invoice-info-value">{formatInvoiceAmount(document.roundOff)}</span>
                    </div>
                  )}
                  <div className="invoice-info-row" style={{ borderTop: '1px solid var(--color-gray-100)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                    <span className="invoice-info-label" style={{ fontWeight: 700, fontSize: '1rem' }}>Grand Total</span>
                    <span className="invoice-info-value" style={{ fontWeight: 700, fontSize: '1.125rem' }}>{formatInvoiceAmount(document.grandTotal)}</span>
                  </div>
                  {document.notes && (
                    <div className="invoice-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
                      <span className="invoice-info-label">Notes</span>
                      <p style={{ lineHeight: 1.5, color: 'var(--color-gray-700)' }}>{document.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'items' && (
                <div className="invoice-items-tab">
                  {document.lineItems.length === 0 ? (
                    <EmptyState
                      icon={<FileText size={32} aria-hidden="true" />}
                      title="No items"
                      description="This invoice has no line items."
                    />
                  ) : (
                    <div className="invoice-items-list" role="list" aria-label="Line items">
                      {document.lineItems.map((item) => (
                        <div key={item.id} className="card invoice-item-card" role="listitem">
                          <div className="invoice-item-header">
                            <span className="invoice-item-name">{item.product.name}</span>
                            <span className="invoice-item-total">{formatInvoiceAmount(item.lineTotal)}</span>
                          </div>
                          <div className="invoice-item-meta">
                            <span>{item.quantity} {item.product.unit} × {formatInvoiceAmount(item.rate)}</span>
                            {item.discountAmount > 0 && (
                              <span style={{ color: 'var(--color-error-600)' }}>
                                Disc: -{formatInvoiceAmount(item.discountAmount)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'share' && (
                <div className="invoice-share-tab">
                  {document.shareLogs.length === 0 ? (
                    <EmptyState
                      icon={<Share2 size={32} aria-hidden="true" />}
                      title="Not shared yet"
                      description="Share this invoice via WhatsApp, email, or print."
                      action={
                        <button className="btn btn-primary btn-md" aria-label="Share invoice now">
                          Share Invoice
                        </button>
                      }
                    />
                  ) : (
                    <div className="invoice-share-list" role="list" aria-label="Share history">
                      {document.shareLogs.map((log) => (
                        <div key={log.id} className="card invoice-share-card" role="listitem">
                          <div className="invoice-share-channel">{log.channel}</div>
                          <div className="invoice-share-date">{formatInvoiceDate(log.sentAt)}</div>
                          {log.recipientPhone && (
                            <div className="invoice-share-recipient">{log.recipientPhone}</div>
                          )}
                          {log.recipientEmail && (
                            <div className="invoice-share-recipient">{log.recipientEmail}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </PageContainer>
    </AppShell>
  )
}
