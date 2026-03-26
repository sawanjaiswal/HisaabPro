/** Edit Invoice — Page (lazy loaded) */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { getDocument } from './invoice.service'
import { EditInvoiceForm } from './components/EditInvoiceForm'
import type { DocumentFormData, DocumentDetail, PaymentTerms } from './invoice.types'
import './invoice-party-search.css'
import './invoice-line-items.css'
import './invoice-product-search.css'
import './invoice-summary.css'

function detailToFormData(detail: DocumentDetail): DocumentFormData {
  return {
    type: detail.type,
    status: detail.status === 'DRAFT' ? 'DRAFT' : 'SAVED',
    partyId: detail.party.id,
    documentDate: detail.documentDate.slice(0, 10),
    paymentTerms: detail.paymentTerms as PaymentTerms | undefined,
    dueDate: detail.dueDate?.slice(0, 10),
    shippingAddressId: null,
    notes: detail.notes ?? '',
    termsAndConditions: detail.termsAndConditions ?? '',
    vehicleNumber: detail.vehicleNumber ?? '',
    includeSignature: detail.includeSignature,
    lineItems: detail.lineItems.map((li) => ({
      productId: li.product.id,
      quantity: li.quantity,
      rate: li.rate,
      discountType: li.discountType,
      discountValue: li.discountValue,
    })),
    additionalCharges: detail.additionalCharges.map((ch) => ({
      name: ch.name,
      type: ch.type,
      value: ch.value,
    })),
    transportDetails: detail.transportDetails ?? null,
  }
}

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const invoiceId = id ?? ''
  const [loadStatus, setLoadStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [initialData, setInitialData] = useState<DocumentFormData | undefined>()
  const [productNameMap, setProductNameMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const controller = new AbortController()
    setLoadStatus('loading')

    getDocument(invoiceId, controller.signal)
      .then((detail) => {
        setInitialData(detailToFormData(detail))
        const nameMap: Record<string, string> = {}
        for (const li of detail.lineItems) {
          nameMap[li.product.id] = li.product.name
        }
        setProductNameMap(nameMap)
        setLoadStatus('ready')
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setLoadStatus('error')
      })

    return () => controller.abort()
  }, [invoiceId])

  if (loadStatus === 'loading') {
    return (
      <AppShell>
        <Header title={t.editInvoice} backTo={`/invoices/${invoiceId}`} />
        <PageContainer>
          <Skeleton height="2.5rem" borderRadius="var(--radius-full)" />
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Skeleton height="5rem" borderRadius="var(--radius-md)" count={3} />
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (loadStatus === 'error' || !initialData) {
    return (
      <AppShell>
        <Header title={t.editInvoice} backTo={`/invoices/${invoiceId}`} />
        <PageContainer>
          <ErrorState
            title={t.couldNotLoadInvoice}
            message={t.checkConnectionRetry}
            onRetry={() => window.location.reload()}
          />
        </PageContainer>
      </AppShell>
    )
  }

  return (
    <EditInvoiceForm
      invoiceId={invoiceId}
      initialData={initialData}
      initialProductNames={productNameMap}
    />
  )
}
