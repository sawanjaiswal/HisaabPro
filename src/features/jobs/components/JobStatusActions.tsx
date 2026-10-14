/** JobStatusActions — buttons mapping current → allowed transitions */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { getNextStatuses } from '../jobs.utils'
import { useTransitionJob } from '../hooks/useTransitionJob'
import type { JobStatus } from '../jobs.types'
import { Input } from '@/components/ui/Input'

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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => (
          <Button
            key={status}
            type="button"
            variant={status === 'CANCELLED' ? 'destructive' : 'primary'}
            size="sm"
            onClick={() => handleTransition(status)}
            disabled={isPending}
            className="min-h-[44px]"
          >
            {STATUS_BUTTON_LABELS[status]}
          </Button>
        ))}
      </div>

      {showCancelPrompt && (
        <div className="flex flex-col gap-2 p-3 bg-red-50 rounded-lg">
          <label className="text-sm font-medium text-red-700">
            {t.jobCancelReasonLabel} *
          </label>
          <Input
            type="text"
            className="input"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t.jobCancelReasonRequired}
            maxLength={500}
            aria-label={t.jobCancelReasonLabel}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleCancelConfirm}
              disabled={!cancelReason.trim() || isPending}
              className="min-h-[44px]"
            >
              {t.jobConfirmCancel}
            </Button>
            <Button
              type="button"
              variant="ghost" size="sm"
              onClick={() => { setShowCancelPrompt(false); setCancelReason('') }}
              className="min-h-[44px]"
            >
              {t.jobCancelBack}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
