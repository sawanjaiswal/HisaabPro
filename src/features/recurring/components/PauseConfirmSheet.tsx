/** PauseConfirmSheet — bottom sheet confirmation for pausing a schedule */

import { useRef } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface PauseConfirmSheetProps {
  open: boolean
  scheduleName: string
  isPausing: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function PauseConfirmSheet({
  open,
  scheduleName,
  isPausing,
  onCancel,
  onConfirm,
}: PauseConfirmSheetProps) {
  const { t } = useLanguage()
  const sheetRef = useRef<HTMLDivElement>(null)
  useFocusTrap(sheetRef, { active: open, onEscape: onCancel, disabled: isPausing })

  if (!open) return null

  return (
    <>
      <div
        className="recurring-sheet-overlay"
        role="presentation"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className="recurring-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-sheet-title"
      >
        <div className="recurring-sheet__handle" aria-hidden="true" />
        <h2 className="recurring-sheet__title" id="pause-sheet-title">
          {t.recurringPause ?? 'Pause Schedule'}
        </h2>
        <p className="recurring-sheet__body">
          {t.recurringPauseConfirm ?? 'Pause'} <strong>{scheduleName}</strong>?{' '}
          {t.recurringPauseDesc ?? 'Runs during the pause period will be skipped.'}
        </p>
        <div className="recurring-sheet__actions">
          <button
            type="button"
            className="recurring-btn recurring-btn--secondary"
            onClick={onCancel}
            disabled={isPausing}
          >
            {t.cancelBtn ?? 'Cancel'}
          </button>
          <button
            type="button"
            className="recurring-btn recurring-btn--warning"
            onClick={onConfirm}
            disabled={isPausing}
            aria-busy={isPausing}
          >
            {isPausing
              ? (t.recurringPausing ?? 'Pausing...')
              : (t.recurringPause ?? 'Pause')}
          </button>
        </div>
      </div>
    </>
  )
}
