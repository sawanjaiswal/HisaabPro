/** PauseConfirmSheet — bottom sheet confirmation for pausing a schedule */

import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'

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

  return (
    <Drawer
      open={open}
      onClose={onCancel}
      title={t.recurringPause ?? 'Pause Schedule'}
      size="sm"
      // Mid-pause the sheet must stay put — dismissing it would strand the
      // request with no visible outcome.
      persistent={isPausing}
      footer={
        <>
          <Button variant="none"
            type="button"
            className="recurring-btn recurring-btn--secondary"
            onClick={onCancel}
            disabled={isPausing}
          >
            {t.cancelBtn ?? 'Cancel'}
          </Button>
          <Button variant="none"
            type="button"
            className="recurring-btn recurring-btn--warning"
            onClick={onConfirm}
            disabled={isPausing}
            aria-busy={isPausing}
          >
            {isPausing
              ? (t.recurringPausing ?? 'Pausing...')
              : (t.recurringPause ?? 'Pause')}
          </Button>
        </>
      }
    >
      <p className="recurring-sheet__body">
        {t.recurringPauseConfirm ?? 'Pause'} <strong>{scheduleName}</strong>?{' '}
        {t.recurringPauseDesc ?? 'Runs during the pause period will be skipped.'}
      </p>
    </Drawer>
  )
}
