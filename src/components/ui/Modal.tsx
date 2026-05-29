/** Modal — Radix Dialog re-skinned with the existing modal CSS.
 *
 * Public API is unchanged ({ open, onClose, title, children }) so every
 * existing call site works without edits — Radix now supplies the focus
 * trap, scroll-lock, Escape handling and portalling that the hand-rolled
 * native <dialog> version lacked.
 */
import type { ReactNode } from 'react'
import { Dialog as RX } from 'radix-ui'
import { X } from 'lucide-react'
import './overlay.css'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  return (
    <RX.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <RX.Portal>
        <RX.Overlay className="rx-dialog-overlay" />
        <RX.Content className="rx-dialog-content modal">
          <div className="modal-header">
            <RX.Title className="modal-title">{title}</RX.Title>
            <RX.Close asChild>
              <button className="modal-close" aria-label="Close">
                <X size={20} />
              </button>
            </RX.Close>
          </div>
          <div className="modal-body">{children}</div>
        </RX.Content>
      </RX.Portal>
    </RX.Root>
  )
}
