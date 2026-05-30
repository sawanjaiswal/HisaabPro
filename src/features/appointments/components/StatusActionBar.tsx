/** StatusActionBar — bottom-of-Drawer action row on AppointmentDetailPage.
 *
 * Renders one button per allowed forward transition. NOT raw position:fixed —
 * lives inside the Drawer `footer` slot per PLATFORM_SHELL C6 + C9.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'
import { ACTION_LABEL_KEY, STATUS_TRANSITIONS } from '../appointment.constants'
import type { AppointmentRow, AppointmentStatus } from '../appointment.types'
import type { TranslationKey } from '@/lib/translations'

interface StatusActionBarProps {
  row: AppointmentRow
  isPatching: boolean
  onPatch: (toStatus: AppointmentStatus, reason: string | null) => void
}

export function StatusActionBar({ row, isPatching, onPatch }: StatusActionBarProps) {
  const { t } = useLanguage()
  const transitions = STATUS_TRANSITIONS[row.status]
  const [confirmTarget, setConfirmTarget] = useState<AppointmentStatus | null>(null)

  if (transitions.length === 0) {
    return (
      <p className="text-[var(--fs-sm)]" style={{ color: 'var(--color-text-muted)' }}>
        {t.appointmentNoMoreTransitions ?? 'No further actions available.'}
      </p>
    )
  }

  const isDestructive = (s: AppointmentStatus) => s === 'CANCELLED' || s === 'NO_SHOW'

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {transitions.map((to) => {
          const labelKey = ACTION_LABEL_KEY[to] as TranslationKey
          const label = (t[labelKey] as string | undefined) ?? to
          return (
            <Button
              key={to}
              variant={isDestructive(to) ? 'destructive' : 'primary'}
              disabled={isPatching}
              onClick={() => {
                if (isDestructive(to)) setConfirmTarget(to)
                else onPatch(to, null)
              }}
            >
              {label}
            </Button>
          )
        })}
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) onPatch(confirmTarget, null)
          setConfirmTarget(null)
        }}
        title={confirmTarget === 'CANCELLED' ? (t.confirmCancel ?? 'Cancel appointment?') : (t.noShow ?? 'Mark no-show?')}
        description={t.appointmentDestructiveDesc ?? 'This action cannot be undone.'}
        confirmLabel={confirmTarget === 'CANCELLED' ? (t.confirmCancel ?? 'Cancel') : (t.noShow ?? 'No-show')}
        cancelLabel={t.back ?? 'Back'}
        isDanger
        isLoading={isPatching}
      />
    </>
  )
}
