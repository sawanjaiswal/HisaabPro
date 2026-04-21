import { useEffect, useRef, useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import './drawer-panel.css'
import './drawer-content.css'

/** Duration must match CSS closing animation durations:
 *  mobile  → drawer-slide-down-out: 200ms
 *  desktop → drawer-modal-exit:     150ms
 *  Use the longer value so both finish before unmount. */
const CLOSE_ANIMATION_DURATION_MS = 200

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Width of the modal on desktop. sm=400px · md=520px · lg=640px. Default 'md'. */
  size?: 'sm' | 'md' | 'lg'
  /** Show close (X) button in the header. Default true. */
  showClose?: boolean
  /** Prevent closing on backdrop click or Escape key. */
  persistent?: boolean
  /** Optional footer slot — rendered below the scrollable body. */
  footer?: ReactNode
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
  persistent = false,
  footer,
}: DrawerProps) {
  // `isVisible` trails `open` — stays true until the exit animation finishes.
  const [isVisible, setIsVisible] = useState(false)
  const [animState, setAnimState] = useState<'open' | 'closing'>('open')

  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedOverflowRef = useRef<string>('')

  // ── Open / close lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      // Cancel any in-progress close
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      // Save trigger so we can restore focus on close
      triggerRef.current = document.activeElement as HTMLElement
      // Lock body scroll
      savedOverflowRef.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      setIsVisible(true)
      setAnimState('open')
    } else {
      if (!isVisible) return
      setAnimState('closing')
      closeTimerRef.current = setTimeout(() => {
        setIsVisible(false)
        // Restore body scroll
        document.body.style.overflow = savedOverflowRef.current
        // Restore focus to the element that opened the drawer
        triggerRef.current?.focus()
        triggerRef.current = null
        closeTimerRef.current = null
      }, CLOSE_ANIMATION_DURATION_MS)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Clean up timer and scroll lock on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current)
      document.body.style.overflow = savedOverflowRef.current
    }
  }, [])

  // ── Focus trap ─────────────────────────────────────────────────────────

  /** Returns all currently focusable elements inside the panel. */
  const getFocusable = useCallback((): HTMLElement[] => {
    if (!panelRef.current) return []
    return Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), ' +
        'input:not([disabled]), select:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.closest('[aria-hidden="true"]'))
  }, [])

  /** Focus the first focusable element inside the panel on open. */
  useEffect(() => {
    if (!isVisible || animState !== 'open') return
    // Small delay so the panel is painted before we try to focus
    const id = setTimeout(() => {
      const focusable = getFocusable()
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        panelRef.current?.focus()
      }
    }, 50)
    return () => clearTimeout(id)
  }, [isVisible, animState, getFocusable])

  // ── Keyboard handler ───────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!persistent) onClose()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [getFocusable, onClose, persistent]
  )

  useEffect(() => {
    if (!isVisible) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, handleKeyDown])

  // ── Backdrop click ─────────────────────────────────────────────────────

  const handleBackdropClick = useCallback(() => {
    if (!persistent) onClose()
  }, [persistent, onClose])

  // ── Nothing to render ──────────────────────────────────────────────────

  if (!isVisible) return null

  const hasHeader = Boolean(title) || showClose

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-backdrop py-0"
        data-state={animState}
        aria-hidden="true"
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
        aria-label={!title ? 'Dialog' : undefined}
        className="drawer-panel py-0"
        data-state={animState}
        data-size={size}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — visible on mobile only via CSS */}
        <div className="drawer-drag-handle py-0" aria-hidden="true" />

        {/* Header */}
        {hasHeader && (
          <div className="drawer-header py-0">
            {title && (
              <h2 id="drawer-title" className="drawer-title py-0">
                {title}
              </h2>
            )}
            {showClose && (
              <button
                type="button"
                className="drawer-close py-0"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable body */}
        <div className="drawer-body py-0">{children}</div>

        {/* Footer */}
        {footer && <div className="drawer-footer py-0">{footer}</div>}
      </div>
    </>
  )
}
