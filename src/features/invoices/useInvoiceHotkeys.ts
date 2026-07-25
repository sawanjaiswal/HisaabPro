/** useInvoiceHotkeys — desktop power shortcuts for the invoice create flow.
 *
 *   Cmd/Ctrl+K → quick add (open + focus the product search)
 *   Cmd/Ctrl+S → save (also suppresses the browser's "save page" dialog)
 *   Esc        → close the product search panel
 *
 * F2 (open the barcode scan loop) is bound inside InvoiceScanButton, which owns
 * the scanner's open state. These are desktop muscle-memory; on touch they
 * simply never fire. Cmd/Ctrl+S is used instead of the plan's ⌥S because ⌥S
 * inserts a glyph on macOS and Cmd/Ctrl+S is the universal save chord.
 */

import { useEffect } from 'react'

interface InvoiceHotkeys {
  onQuickAdd: () => void
  onSave: () => void
  onEscape?: () => void
}

export function useInvoiceHotkeys({ onQuickAdd, onSave, onEscape }: InvoiceHotkeys) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        onQuickAdd()
      } else if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        onSave()
      } else if (e.key === 'Escape') {
        onEscape?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onQuickAdd, onSave, onEscape])
}
