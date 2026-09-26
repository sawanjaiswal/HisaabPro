/**
 * OverlayShell — Standard Level 6 Shell for Modals, Drawers & Bottom Sheets.
 *
 * Enforces:
 * 1. Pinned header with title, drag-handle (on mobile), and close button.
 * 2. `flex-1 min-h-0 overflow-y-auto` scrollable content body.
 * 3. Pinned sticky footer for primary/secondary action buttons.
 * 4. Keyboard trap, Escape key handling, and mobile swipe-to-dismiss gesture.
 */

import type { ReactNode } from 'react'
import { Drawer } from '@/components/ui/Drawer'

export interface OverlayShellProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when closed */
  onClose: () => void
  /** Dialog title */
  title?: string
  /** Scrollable modal body */
  children: ReactNode
  /** Sticky footer buttons (Cancel / Submit) */
  footer?: ReactNode
  /** Size on desktop: sm (400px), md (520px), lg (640px) */
  size?: 'sm' | 'md' | 'lg'
  /** Prevent dismissal on backdrop click or ESC */
  persistent?: boolean
  /** Show close button */
  showClose?: boolean
}

export function OverlayShell({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  persistent = false,
  showClose = true,
}: OverlayShellProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      persistent={persistent}
      showClose={showClose}
      footer={
        footer ? (
          <div className="flex items-center gap-3 w-full py-0">
            {footer}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4 py-0">{children}</div>
    </Drawer>
  )
}
