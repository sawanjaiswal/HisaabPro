/**
 * Backfill Wizard — Step 1: Preview
 *
 * Shows how many products / invoices are untagged.
 * 4 UI states: loading skeleton · error · (no empty — count can be 0) · success
 */

import type { Dispatch } from 'react'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import type { BackfillPreviewRes, WizardAction, WizardOptions } from '../gst-returns.types'
import { defaultOptions } from '../backfill-wizard.reducer'

interface Props {
  loading: boolean
  error: string | null
  preview: BackfillPreviewRes | null
  onRetry: () => void
  dispatch: Dispatch<WizardAction>
}

function PreviewSkeleton() {
  return (
    <div className="bfw-skeleton" aria-busy="true" aria-label="Loading preview">
      {[1, 2].map(n => (
        <div key={n} className="bfw-skeleton-card">
          <div className="bfw-skeleton-line bfw-skeleton-line--short" />
          <div className="bfw-skeleton-line bfw-skeleton-line--full" />
        </div>
      ))}
    </div>
  )
}

export function BackfillStep1Preview({ loading, error, preview, onRetry, dispatch }: Props) {
  const { t } = useLanguage()

  function handleNext() {
    if (!preview) return
    const options: WizardOptions = defaultOptions()
    dispatch({ type: 'GO_OPTIONS', options })
  }

  if (loading) return <PreviewSkeleton />

  if (error) {
    return (
      <div className="bfw-error">
        <AlertTriangle size={24} aria-hidden="true" />
        <p className="bfw-error-msg">{error}</p>
        <Button variant="secondary" size="md" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    )
  }

  if (!preview) return null

  return (
    <div className="bfw-step">
      <p className="bfw-step-desc">{t.backfillPreviewDesc}</p>

      <div className="bfw-stat-grid">
        <div className="bfw-stat-card">
          <span className="bfw-stat-value">{preview.untaggedProductCount}</span>
          <span className="bfw-stat-label">{t.backfillUntaggedProducts}</span>
          <span className="bfw-stat-sub">{formatPaise(preview.untaggedProductValue)}</span>
        </div>

        <div className="bfw-stat-card">
          <span className="bfw-stat-value">{preview.nullPosInvoiceCount}</span>
          <span className="bfw-stat-label">{t.backfillNullPosInvoices}</span>
          <span className="bfw-stat-sub">{formatPaise(preview.nullPosTaxableValue)}</span>
        </div>
      </div>

      {preview.untaggedProductCount === 0 && preview.nullPosInvoiceCount === 0 && (
        <div className="bfw-notice bfw-notice--success" role="status">
          {t.backfillNothingToFix}
        </div>
      )}

      <div className="bfw-actions">
        <Button
          variant="primary" size="lg" className="bfw-btn-full"
          onClick={handleNext}
          aria-label={t.backfillNextStep}
        >
          {t.next}
          <ChevronRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
