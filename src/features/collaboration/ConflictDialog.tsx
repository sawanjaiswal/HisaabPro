// #150 ConflictDialog — shown when a save loses the optimistic-lock race.
// Money records must never silently auto-merge, so the user explicitly chooses:
//   Reload  — discard local edits, refetch the server's current truth.
//   Overwrite — re-save on top of the server version (permission-gated server-side).
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { ConflictInfo } from './collaboration.types'
import './collaboration.css'

interface ConflictDialogProps {
  conflict: ConflictInfo | null
  overwriting: boolean
  onReload: () => void
  onOverwrite: () => void
  onDismiss: () => void
}

export function ConflictDialog({ conflict, overwriting, onReload, onOverwrite, onDismiss }: ConflictDialogProps) {
  const { t } = useLanguage()
  const open = conflict !== null
  // Overwrite needs the server version to re-apply on top of; without it (rare
  // edge / foreign id) we only offer Reload.
  const canOverwrite = conflict?.serverVersion !== undefined

  return (
    <Modal open={open} onClose={onDismiss} title={t.conflictTitle}>
      <div className="conflict-dialog">
        <div className="conflict-dialog__icon" aria-hidden="true">
          <AlertTriangle size={24} />
        </div>
        <p className="conflict-dialog__body">{t.conflictBody}</p>
        <div className="conflict-dialog__actions">
          <Button variant="primary" onClick={onReload} disabled={overwriting}>
            {t.conflictReload}
          </Button>
          {canOverwrite && (
            <Button variant="destructive" onClick={onOverwrite} loading={overwriting}>
              {t.conflictOverwrite}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
