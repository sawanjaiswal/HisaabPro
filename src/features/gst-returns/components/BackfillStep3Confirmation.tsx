/**
 * Backfill Wizard — Step 3: Confirmation
 *
 * Summary of choices, warning, big red Proceed button.
 * Proceed is disabled when offline.
 */

import type { Dispatch } from 'react'
import { Button } from '@/components/ui/Button'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import type { WizardAction, WizardOptions, BackfillPreviewRes } from '../gst-returns.types'

interface Props {
  options: WizardOptions
  preview: BackfillPreviewRes
  dispatch: Dispatch<WizardAction>
  onProceed: () => void
  isPending: boolean
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function BackfillStep3Confirmation({
  options,
  preview,
  dispatch,
  onProceed,
  isPending,
}: Props) {
  const { t } = useLanguage()
  const toast = useToast()

  function handleProceed() {
    if (!navigator.onLine) {
      toast.error(t.backfillMustBeOnline)
      return
    }
    onProceed()
  }

  const isOffline = !navigator.onLine

  return (
    <div className="bfw-step">
      <div className="bfw-warning" role="alert">
        <AlertTriangle size={20} aria-hidden="true" />
        <p>{t.backfillCannotBeUndone}</p>
      </div>

      <div className="bfw-summary-card">
        <div className="bfw-summary-row">
          <span className="bfw-summary-key">{t.backfillUntaggedProducts}</span>
          <span className="bfw-summary-val">{preview.untaggedProductCount}</span>
        </div>
        <div className="bfw-summary-row">
          <span className="bfw-summary-key">{t.backfillNullPosInvoices}</span>
          <span className="bfw-summary-val">{preview.nullPosInvoiceCount}</span>
        </div>
        <div className="bfw-summary-row">
          <span className="bfw-summary-key">{t.backfillDateRange}</span>
          <span className="bfw-summary-val">
            {formatDate(options.dateRange[0])} — {formatDate(options.dateRange[1])}
          </span>
        </div>
        <div className="bfw-summary-row">
          <span className="bfw-summary-key">{t.backfillSetPosFromParty}</span>
          <span className="bfw-summary-val">
            {options.setPositionFromParty ? t.yes : t.no}
          </span>
        </div>
      </div>

      {isOffline && (
        <div className="bfw-notice bfw-notice--warn" role="alert">
          {t.backfillMustBeOnline}
        </div>
      )}

      <div className="bfw-actions bfw-actions--row">
        <Button
          variant="secondary" size="md"
          onClick={() => dispatch({ type: 'BACK' })}
          disabled={isPending}
        >
          <ChevronLeft size={18} aria-hidden="true" />
          {t.back}
        </Button>
        <Button variant="none"
          className="btn btn-danger btn-md bfw-btn-proceed"
          onClick={handleProceed}
          disabled={isPending || isOffline}
          aria-label={t.backfillProceed}
        >
          {isPending ? (t.backfillStarting ?? 'Starting...') : (t.backfillProceed)}
        </Button>
      </div>
    </div>
  )
}
