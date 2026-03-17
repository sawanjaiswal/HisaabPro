/** ConfirmDialog — shared destructive-action confirmation dialog
 *
 * Uses native <dialog> (same as Modal.tsx). role="alertdialog" signals to
 * screen readers that this requires an immediate response. Confirm button
 * receives focus on open so keyboard users can confirm with Enter and
 * cancel with Escape without touching the mouse.
 */

import { useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

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
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose()
    },
    [onClose, isLoading]
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      previousFocus.current = document.activeElement as HTMLElement
      dialog.showModal()
      // Focus confirm so keyboard users can act immediately
      requestAnimationFrame(() => confirmRef.current?.focus())
      document.addEventListener('keydown', handleKeyDown)
    } else {
      dialog.close()
      previousFocus.current?.focus()
    }

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (isLoading) return
    // Only close when clicking the dialog backdrop, not its content
    if (e.target === dialogRef.current) onClose()
  }

  if (!open) return null

  const descriptionId = 'confirm-dialog-description'

  return (
    <dialog
      ref={dialogRef}
      className="modal confirm-dialog"
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={descriptionId}
      onClick={handleBackdropClick}
    >
      <div className="confirm-dialog-body">
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h2>
        <p id={descriptionId} className="confirm-dialog-description">
          {description}
        </p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn btn-ghost btn-md confirm-dialog-cancel"
            onClick={onClose}
            disabled={isLoading}
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn btn-md${isDanger ? ' btn-destructive' : ' btn-primary'}`}
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
          </button>
        </div>
      </div>
    </dialog>
  )
}
