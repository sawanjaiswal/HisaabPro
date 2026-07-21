/** GenerateNowConfirmSheet — bottom sheet confirmation for generate-now action */

import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'

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

  return (
    <Drawer
      open={open}
      onClose={onCancel}
      title={t.recurringGenerateNow ?? 'Generate Now'}
      size="sm"
      // Mid-generate the sheet must stay put — dismissing it would strand the
      // request with no visible outcome.
      persistent={isGenerating}
      footer={
        <>
          <Button variant="none"
            type="button"
            className="recurring-btn recurring-btn--secondary"
            onClick={onCancel}
            disabled={isGenerating}
          >
            {t.cancelBtn ?? 'Cancel'}
          </Button>
          <Button variant="none"
            type="button"
            className="recurring-btn recurring-btn--primary"
            onClick={onConfirm}
            disabled={isGenerating}
            aria-busy={isGenerating}
          >
            {isGenerating
              ? (t.recurringGenerating ?? 'Generating...')
              : (t.recurringGenerateNow ?? 'Generate')}
          </Button>
        </>
      }
    >
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
    </Drawer>
  )
}
