/** ConfirmDialog — destructive-action confirmation on Radix AlertDialog.
 *
 * Public API (ConfirmDialogProps) is unchanged, so all ~34 call sites work
 * without edits. Radix AlertDialog gives a real focus trap, role="alertdialog",
 * Escape handling and initial focus on the confirm action — replacing the
 * hand-rolled native <dialog> version.
 */
import { AlertDialog as RX } from 'radix-ui'
import { Loader2 } from 'lucide-react'
import { Button } from './Button'
import './overlay.css'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  /** Explains what will be lost or happen — must be specific, not "Are you sure?" */
  description: string
  /** Confirm button label. Default: "Delete" */
  confirmLabel?: string
  /** Cancel button label. Default: "Cancel" */
  cancelLabel?: string
  /** Makes confirm button red/danger style. Default: true */
  isDanger?: boolean
  /** Shows loading spinner on confirm button and disables both buttons */
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDanger = true,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <RX.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !isLoading) onClose()
      }}
    >
      <RX.Portal>
        <RX.Overlay className="rx-dialog-overlay" />
        <RX.Content
          className="rx-dialog-content modal confirm-dialog"
          onEscapeKeyDown={(e) => { if (isLoading) e.preventDefault() }}
        >
          <div className="confirm-dialog-body">
            <RX.Title className="confirm-dialog-title">{title}</RX.Title>
            <RX.Description className="confirm-dialog-description">{description}</RX.Description>
            <div className="confirm-dialog-actions">
              <RX.Cancel asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  className="confirm-dialog-cancel"
                  disabled={isLoading}
                >
                  {cancelLabel}
                </Button>
              </RX.Cancel>
              <Button
                type="button"
                variant={isDanger ? 'destructive' : 'primary'}
                size="md"
                onClick={onConfirm}
                disabled={isLoading}
                aria-label={isLoading ? 'Deleting…' : confirmLabel}
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="spinner" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  confirmLabel
                )}
              </Button>
            </div>
          </div>
        </RX.Content>
      </RX.Portal>
    </RX.Root>
  )
}
