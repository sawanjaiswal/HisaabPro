/** RunHistoryRow — single row in the run history list */

import { CheckCircle2, XCircle, SkipForward, AlertTriangle, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '@/lib/format'
import { RUN_STATUS_LABELS } from '../recurring.constants'
import type { RecurringRun, RecurringRunStatus } from '../recurring.types'

interface RunHistoryRowProps {
  run: RecurringRun
}

const STATUS_ICON: Record<RecurringRunStatus, React.ReactNode> = {
  SUCCESS: <CheckCircle2 size={16} className="recurring-run__icon recurring-run__icon--success" />,
  SUCCESS_PARTIAL: <AlertTriangle size={16} className="recurring-run__icon recurring-run__icon--partial" />,
  FAILED: <XCircle size={16} className="recurring-run__icon recurring-run__icon--failed" />,
  SKIPPED: <SkipForward size={16} className="recurring-run__icon recurring-run__icon--skipped" />,
}

const STATUS_CLASS: Record<RecurringRunStatus, string> = {
  SUCCESS: 'recurring-run__status recurring-run__status--success',
  SUCCESS_PARTIAL: 'recurring-run__status recurring-run__status--partial',
  FAILED: 'recurring-run__status recurring-run__status--failed',
  SKIPPED: 'recurring-run__status recurring-run__status--skipped',
}

export function RunHistoryRow({ run }: RunHistoryRowProps) {
  const navigate = useNavigate()

  return (
    <div className="recurring-run">
      <div className="recurring-run__left">
        {STATUS_ICON[run.status]}
        <div className="recurring-run__info">
          <span className={STATUS_CLASS[run.status]}>
            {RUN_STATUS_LABELS[run.status]}
          </span>
          <span className="recurring-run__date">
            {formatDate(run.ranAt)}
          </span>
          {run.warning && (
            <span className="recurring-run__warning" title={run.warning}>
              <AlertTriangle size={12} aria-hidden="true" />
              {run.warning.replace(/_/g, ' ')}
            </span>
          )}
          {run.errorMessage && (
            <span className="recurring-run__error-msg" title={run.errorMessage}>
              {run.errorMessage}
            </span>
          )}
        </div>
      </div>
      {run.generatedDocumentId && (
        <button
          type="button"
          className="recurring-run__link"
          onClick={() => navigate(`/invoices/${run.generatedDocumentId}`)}
          aria-label="View generated invoice"
        >
          <ExternalLink size={14} aria-hidden="true" />
          View
        </button>
      )}
    </div>
  )
}
