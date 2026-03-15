import { useEffect, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      previousFocus.current = document.activeElement as HTMLElement
      dialog.showModal()
      document.addEventListener('keydown', handleKeyDown)
    } else {
      dialog.close()
      previousFocus.current?.focus()
    }

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <dialog ref={dialogRef} className="modal" aria-labelledby="modal-title">
      <div className="modal-header">
        <h2 id="modal-title" className="modal-title">{title}</h2>
        <button onClick={onClose} className="modal-close" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  )
}
