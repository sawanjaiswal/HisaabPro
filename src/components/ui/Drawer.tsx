/** Drawer — unified bottom-sheet (mobile) / centered modal (desktop).
 *
 * Rebuilt on Radix Dialog: focus-trap, scroll-lock, Escape and portalling
 * are now handled by Radix (replacing the 225-LOC hand-rolled trap with its
 * setTimeout focus race). Open/close animation is the existing CSS keyframes
 * (drawer-panel.css) — Radix's Presence waits for the exit animation before
 * unmounting, so there is no JS close timer.
 *
 * Public API (DrawerProps) is unchanged — all ~40 call sites work as-is.
 * Mobile gains real drag-to-dismiss on the handle; desktop is unaffected
 * (the handle is display:none ≥768px, so the drag listeners never fire there).
 */
import { useRef } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { Dialog as RX } from 'radix-ui'
import { X } from 'lucide-react'
import './drawer-panel.css'
import './drawer-content.css'

/** Drag distance (px) past which release dismisses the sheet. */
const DISMISS_THRESHOLD = 100

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
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)

  const onHandleDown = (e: PointerEvent) => {
    if (!panelRef.current) return
    dragStartY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
    // Release the open keyframe (fill-mode: both holds transform) so the
    // inline drag transform below can actually move the panel.
    panelRef.current.style.animation = 'none'
  }

  const onHandleMove = (e: PointerEvent) => {
    if (dragStartY.current === null || !panelRef.current) return
    const dy = Math.max(0, e.clientY - dragStartY.current)
    panelRef.current.style.transition = 'none'
    panelRef.current.style.transform = `translateY(${dy}px)`
  }

  const onHandleUp = (e: PointerEvent) => {
    if (dragStartY.current === null || !panelRef.current) return
    const dy = Math.max(0, e.clientY - dragStartY.current)
    dragStartY.current = null
    const panel = panelRef.current
    if (dy > DISMISS_THRESHOLD && !persistent) {
      // Continue the gesture: slide fully off-screen, then unmount.
      panel.style.transition = 'transform var(--duration-normal) var(--ease-default)'
      panel.style.transform = 'translateY(100%)'
      window.setTimeout(onClose, 220)
    } else {
      // Snap back to the resting position (animation stays suppressed —
      // the element is unmounted on next close, so inline styles don't leak).
      panel.style.transition = 'transform var(--duration-fast) var(--ease-spring)'
      panel.style.transform = 'translateY(0)'
      window.setTimeout(() => {
        panel.style.transition = ''
        panel.style.transform = ''
      }, 180)
    }
  }

  const hasHeader = Boolean(title) || showClose

  return (
    <RX.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <RX.Portal>
        <RX.Overlay className="drawer-backdrop" />
        <RX.Content
          ref={panelRef}
          className="drawer-panel"
          data-size={size}
          aria-label={!title ? 'Dialog' : undefined}
          onEscapeKeyDown={(e) => { if (persistent) e.preventDefault() }}
          onPointerDownOutside={(e) => { if (persistent) e.preventDefault() }}
          onInteractOutside={(e) => { if (persistent) e.preventDefault() }}
        >
          <div
            className="drawer-drag-handle"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            aria-hidden="true"
          />

          {hasHeader && (
            <div className="drawer-header py-0">
              {title ? (
                <RX.Title className="drawer-title py-0">{title}</RX.Title>
              ) : (
                <RX.Title className="sr-only">Dialog</RX.Title>
              )}
              {showClose && (
                <RX.Close asChild>
                  <button type="button" className="drawer-close py-0" aria-label="Close">
                    <X size={18} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </RX.Close>
              )}
            </div>
          )}

          {!hasHeader && <RX.Title className="sr-only">Dialog</RX.Title>}

          <div className="drawer-body py-0">{children}</div>

          {footer && <div className="drawer-footer py-0">{footer}</div>}
        </RX.Content>
      </RX.Portal>
    </RX.Root>
  )
}
