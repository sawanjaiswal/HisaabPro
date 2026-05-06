/** GenerateNowConfirmSheet — bottom sheet confirmation for generate-now action */

import { useRef } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/format'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface GenerateNowConfirmSheetProps {
  open: boolean
  scheduleName: string
  nextRunDate: string | null
  isGenerating: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function GenerateNowConfirmSheet({
  open,
  scheduleName,
  nextRunDate,
  isGenerating,
  onCancel,
  onConfirm,
}: GenerateNowConfirmSheetProps) {
  const { t } = useLanguage()
  const sheetRef = useRef<HTMLDivElement>(null)
  useFocusTrap(sheetRef, { active: open, onEscape: onCancel, disabled: isGenerating })

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
        aria-labelledby="generate-sheet-title"
      >
        <div className="recurring-sheet__handle" aria-hidden="true" />
        <h2 className="recurring-sheet__title" id="generate-sheet-title">
          {t.recurringGenerateNow ?? 'Generate Now'}
        </h2>
        <p className="recurring-sheet__body">
          {t.recurringGenerateConfirm ?? 'Generate invoice now for'}{' '}
          <strong>{scheduleName}</strong>?{' '}
          {nextRunDate && (
            <>
              {t.recurringNextAutoRun ?? 'Next auto-run still on'}{' '}
              <strong>{formatDate(nextRunDate)}</strong>.
            </>
          )}
        </p>
        <div className="recurring-sheet__actions">
          <button
            type="button"
            className="recurring-btn recurring-btn--secondary"
            onClick={onCancel}
            disabled={isGenerating}
          >
            {t.cancelBtn ?? 'Cancel'}
          </button>
          <button
            type="button"
            className="recurring-btn recurring-btn--primary"
            onClick={onConfirm}
            disabled={isGenerating}
            aria-busy={isGenerating}
          >
            {isGenerating
              ? (t.recurringGenerating ?? 'Generating...')
              : (t.recurringGenerateNow ?? 'Generate')}
          </button>
        </div>
      </div>
    </>
  )
}
