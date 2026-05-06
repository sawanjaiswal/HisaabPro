/** RecurringActionMenu — action bar for detail page: pause/resume/generate/delete */

import { useState } from 'react'
import { Pause, Play, Zap, Trash2, Edit2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { PauseConfirmSheet } from './PauseConfirmSheet'
import { GenerateNowConfirmSheet } from './GenerateNowConfirmSheet'
import type { RecurringInvoice } from '../recurring.types'

interface RecurringActionMenuProps {
  schedule: RecurringInvoice
  onPause: (label: string) => Promise<void>
  onResume: (label: string) => Promise<void>
  onGenerate: (label: string) => Promise<void>
  onDelete: (label: string) => Promise<void>
  isPausing: boolean
  isResuming: boolean
  isGenerating: boolean
  isDeleting: boolean
}

export function RecurringActionMenu({
  schedule,
  onPause,
  onResume,
  onGenerate,
  onDelete,
  isPausing,
  isResuming,
  isGenerating,
  isDeleting,
}: RecurringActionMenuProps) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const toast = useToast()
  const [pauseOpen, setPauseOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)

  const label = schedule.name ?? schedule.partyName ?? schedule.id
  const isOffline = !navigator.onLine

  const handleGenerateClick = () => {
    if (isOffline) {
      toast.error(t.recurringMustBeOnline ?? 'Must be online to generate now.')
      return
    }
    setGenerateOpen(true)
  }

  const handleDeleteClick = async () => {
    if (!window.confirm(t.recurringDeleteConfirm ?? 'Delete this schedule?')) return
    await onDelete(label)
    navigate('/recurring')
  }

  return (
    <div className="recurring-action-menu">
      <button
        type="button"
        className="recurring-action-menu__btn recurring-action-menu__btn--secondary"
        onClick={() => navigate(`/recurring/${schedule.id}/edit`)}
        aria-label={t.recurringEdit ?? 'Edit schedule'}
      >
        <Edit2 size={16} aria-hidden="true" />
        {t.recurringEdit ?? 'Edit'}
      </button>

      {schedule.status === 'ACTIVE' && (
        <button
          type="button"
          className="recurring-action-menu__btn recurring-action-menu__btn--warning"
          onClick={() => setPauseOpen(true)}
          disabled={isPausing}
          aria-busy={isPausing}
          aria-label={t.recurringPause ?? 'Pause schedule'}
        >
          <Pause size={16} aria-hidden="true" />
          {t.recurringPause ?? 'Pause'}
        </button>
      )}

      {schedule.status === 'PAUSED' && (
        <button
          type="button"
          className="recurring-action-menu__btn recurring-action-menu__btn--success"
          onClick={() => void onResume(label)}
          disabled={isResuming}
          aria-busy={isResuming}
          aria-label={t.recurringResume ?? 'Resume schedule'}
        >
          <Play size={16} aria-hidden="true" />
          {isResuming ? '...' : (t.recurringResume ?? 'Resume')}
        </button>
      )}

      {schedule.status !== 'COMPLETED' && (
        <button
          type="button"
          className="recurring-action-menu__btn recurring-action-menu__btn--primary"
          onClick={handleGenerateClick}
          disabled={isGenerating || isOffline}
          aria-busy={isGenerating}
          aria-label={t.recurringGenerateNow ?? 'Generate now'}
          title={isOffline ? (t.recurringMustBeOnline ?? 'Must be online') : undefined}
        >
          <Zap size={16} aria-hidden="true" />
          {t.recurringGenerateNow ?? 'Generate Now'}
        </button>
      )}

      <button
        type="button"
        className="recurring-action-menu__btn recurring-action-menu__btn--danger"
        onClick={() => void handleDeleteClick()}
        disabled={isDeleting}
        aria-busy={isDeleting}
        aria-label={t.recurringDelete ?? 'Delete schedule'}
      >
        <Trash2 size={16} aria-hidden="true" />
        {t.recurringDelete ?? 'Delete'}
      </button>

      <PauseConfirmSheet
        open={pauseOpen}
        scheduleName={label}
        isPausing={isPausing}
        onCancel={() => setPauseOpen(false)}
        onConfirm={async () => {
          await onPause(label)
          setPauseOpen(false)
        }}
      />

      <GenerateNowConfirmSheet
        open={generateOpen}
        scheduleName={label}
        nextRunDate={schedule.nextRunDate}
        isGenerating={isGenerating}
        onCancel={() => setGenerateOpen(false)}
        onConfirm={async () => {
          await onGenerate(label)
          setGenerateOpen(false)
        }}
      />
    </div>
  )
}
