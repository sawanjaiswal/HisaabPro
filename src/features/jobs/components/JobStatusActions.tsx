/** JobStatusActions — buttons mapping current → allowed transitions */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { getNextStatuses } from '../jobs.utils'
import { useTransitionJob } from '../hooks/useTransitionJob'
import type { JobStatus } from '../jobs.types'

interface JobStatusActionsProps {
  jobId: string
  jobTitle: string
  currentStatus: JobStatus
}

export function JobStatusActions({ jobId, jobTitle, currentStatus }: JobStatusActionsProps) {
  const { t } = useLanguage()
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelPrompt, setShowCancelPrompt] = useState(false)
  const { mutate, isPending } = useTransitionJob()

  const STATUS_BUTTON_LABELS: Record<JobStatus, string> = {
    QUOTED:      t.jobActionMarkQuoted,
    SCHEDULED:   t.jobActionSchedule,
    IN_PROGRESS: t.jobActionStartWork,
    COMPLETED:   t.jobActionMarkCompleted,
    INVOICED:    t.jobActionMarkInvoiced,
    CANCELLED:   t.jobActionCancelJob,
  }

  const nextStatuses = getNextStatuses(currentStatus)
  if (nextStatuses.length === 0) return null

  const handleTransition = (to: JobStatus) => {
    if (to === 'CANCELLED') {
      setShowCancelPrompt(true)
      return
    }
    mutate({ id: jobId, data: { toStatus: to }, title: jobTitle })
  }

  const handleCancelConfirm = () => {
    if (!cancelReason.trim()) return
    mutate({
      id: jobId,
      data: { toStatus: 'CANCELLED', reason: cancelReason },
      title: jobTitle,
    })
    setShowCancelPrompt(false)
    setCancelReason('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {nextStatuses.map((status) => (
          <button
            key={status}
            type="button"
            className={status === 'CANCELLED' ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
            onClick={() => handleTransition(status)}
            disabled={isPending}
            style={{ minHeight: 44 }}
          >
            {STATUS_BUTTON_LABELS[status]}
          </button>
        ))}
      </div>

      {showCancelPrompt && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-error-50)', borderRadius: 8 }}>
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-error-700)' }}>
            {t.jobCancelReasonLabel} *
          </label>
          <input
            type="text"
            className="input"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t.jobCancelReasonRequired}
            maxLength={500}
            aria-label={t.jobCancelReasonLabel}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleCancelConfirm}
              disabled={!cancelReason.trim() || isPending}
              style={{ minHeight: 44 }}
            >
              {t.jobConfirmCancel}
            </button>
            <Button
              type="button"
              variant="ghost" size="sm"
              onClick={() => { setShowCancelPrompt(false); setCancelReason('') }}
              style={{ minHeight: 44 }}
            >
              {t.jobCancelBack}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
