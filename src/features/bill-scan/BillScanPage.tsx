/** Bill Scanning / OCR — Page (lazy loaded) */

import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useBillScan } from './useBillScan'
import { toLineItemFormData } from './bill-scan.utils'
import { BillCaptureInput } from './components/BillCaptureInput'
import { ScanProgress } from './components/ScanProgress'
import { OcrResultReview } from './components/OcrResultReview'
import './bill-scan.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function BillScanPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { status, progress, result, error, processImage, updateItem, removeItem, reset } = useBillScan()

  const handleConfirm = () => {
    if (!result) return
    const lineItems = toLineItemFormData(result.extractedItems)
    // Navigate to create invoice with scanned items in state
    navigate(ROUTES.INVOICE_CREATE, {
      state: { scannedItems: lineItems, scannedDate: result.extractedDate },
    })
  }

  return (
    <AppShell>
      <Header
        title={t.scanBill}
        backTo={status === 'idle' ? ROUTES.INVOICES : undefined}
        actions={
          status !== 'idle' && status !== 'processing' ? (
            <button className="btn btn-ghost btn-sm" onClick={reset} aria-label={t.startOver}>
              Reset
            </button>
          ) : undefined
        }
      />

      <PageContainer className="space-y-6">
        {status === 'idle' && (
          <BillCaptureInput onCapture={processImage} />
        )}

        {status === 'processing' && progress && (
          <ScanProgress progress={progress} />
        )}

        {status === 'review' && result && (
          <OcrResultReview
            result={result}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
            onConfirm={handleConfirm}
            onRetry={reset}
          />
        )}

        {status === 'error' && (
          <div className="bill-scan-error fade-up">
            <div className="bill-scan-error-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <h3 className="bill-scan-error-title">{t.couldNotReadBill}</h3>
            <p className="bill-scan-error-message">{error ?? t.tryClearerPhoto}</p>
            <button type="button" className="btn btn-primary btn-md" onClick={reset}>
              Try Again
            </button>
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
