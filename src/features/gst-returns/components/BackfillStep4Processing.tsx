/**
 * Backfill Wizard — Step 4: Processing
 *
 * Non-cancellable. Progress bar (fits 320px). Polls every 2 s.
 * Auto-advances to step 5 when COMPLETED.
 */

import { useEffect, type Dispatch } from 'react'
import { Loader2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useBackfillStatus } from '../useBackfill'
import type { WizardAction } from '../gst-returns.types'

interface Props {
  jobId: string
  dispatch: Dispatch<WizardAction>
}

export function BackfillStep4Processing({ jobId, dispatch }: Props) {
  const { t } = useLanguage()
  const { data: status } = useBackfillStatus(jobId)

  const processed = status?.processed ?? 0
  const total     = status?.total ?? 0
  const errors    = status?.errors ?? []
  const pct       = total > 0 ? Math.round((processed / total) * 100) : 0

  useEffect(() => {
    if (status?.status === 'COMPLETED' || status?.status === 'FAILED') {
      dispatch({ type: 'COMPLETE', status })
    }
  }, [status, dispatch])

  return (
    <div className="bfw-step bfw-step--processing" role="status" aria-live="polite">
      <div className="bfw-processing-icon">
        <Loader2 size={32} className="bfw-spin" aria-hidden="true" />
      </div>

      <p className="bfw-processing-title">{t.backfillProcessingTitle}</p>
      <p className="bfw-processing-sub">{t.backfillDoNotClose}</p>

      <div className="bfw-progress-wrap" aria-label={t.backfillProgress}>
        <div
          className="bfw-progress-bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="bfw-progress-label">
        {processed} / {total > 0 ? total : '…'} {t.backfillComplete ?? 'complete'}
      </p>

      {errors.length > 0 && (
        <div className="bfw-error-list">
          <p className="bfw-error-list-title">{t.backfillErrors}</p>
          <ul>
            {errors.slice(0, 10).map((e, i) => (
              <li key={i} className="bfw-error-item">
                {e.entityType} {e.entityId}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
