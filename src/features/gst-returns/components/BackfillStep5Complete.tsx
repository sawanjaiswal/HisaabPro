/**
 * Backfill Wizard — Step 5: Complete
 *
 * Summary, error list, View Activity Log + Done buttons.
 * Done invalidates relevant TanStack queries.
 */

import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useGstBackfillInvalidate } from '../useBackfill'
import type { BackfillStatusRes } from '../gst-returns.types'

interface Props {
  status: BackfillStatusRes
}

export function BackfillStep5Complete({ status }: Props) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const invalidate = useGstBackfillInvalidate()

  function handleDone() {
    invalidate()
    navigate(ROUTES.SETTINGS_GST)
  }

  function handleViewLog() {
    navigate(ROUTES.SETTINGS_AUDIT_LOG)
  }

  const failed = status.errors.length
  const succeeded = status.processed - failed

  return (
    <div className="bfw-step bfw-step--complete">
      <div className="bfw-complete-icon">
        {status.status === 'FAILED' ? (
          <AlertTriangle size={40} className="bfw-icon--warn" aria-hidden="true" />
        ) : (
          <CheckCircle2 size={40} className="bfw-icon--success" aria-hidden="true" />
        )}
      </div>

      <h2 className="bfw-complete-title">
        {status.status === 'FAILED' ? t.backfillFailedTitle : t.backfillCompleteTitle}
      </h2>

      <div className="bfw-summary-card">
        <div className="bfw-summary-row">
          <span className="bfw-summary-key">{t.backfillSucceeded}</span>
          <span className="bfw-summary-val">{succeeded}</span>
        </div>
        {failed > 0 && (
          <div className="bfw-summary-row">
            <span className="bfw-summary-key">{t.backfillFailed}</span>
            <span className="bfw-summary-val bfw-val--error">{failed}</span>
          </div>
        )}
      </div>

      {status.errors.length > 0 && (
        <div className="bfw-error-list">
          <p className="bfw-error-list-title">{t.backfillErrors}</p>
          <ul>
            {status.errors.slice(0, 20).map((e, i) => (
              <li key={i} className="bfw-error-item">
                {e.entityType} {e.entityId}: {e.message}
              </li>
            ))}
          </ul>
          {status.errors.length > 20 && (
            <p className="bfw-error-overflow">
              {t.backfillMoreErrors?.replace('{n}', String(status.errors.length - 20))}
            </p>
          )}
        </div>
      )}

      <div className="bfw-actions bfw-actions--col">
        <button
          className="btn btn-secondary btn-lg bfw-btn-full"
          onClick={handleViewLog}
          aria-label={t.backfillViewLog}
        >
          {t.backfillViewLog}
        </button>
        <button
          className="btn btn-primary btn-lg bfw-btn-full"
          onClick={handleDone}
          aria-label={t.backfillDone}
        >
          {t.backfillDone}
        </button>
      </div>
    </div>
  )
}
