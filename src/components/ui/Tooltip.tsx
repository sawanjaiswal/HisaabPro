/** Tooltip — Radix Tooltip re-skinned with design tokens.
 *
 *   <Tooltip content="Sync now">
 *     <Button variant="ghost" aria-label="Sync"><RefreshCw /></Button>
 *   </Tooltip>
 *
 * Wrap the app once in <TooltipProvider> (already cheap — Radix shares one
 * delay timer across all tooltips).
 */
import type { ReactNode } from 'react'
import { Tooltip as RX } from 'radix-ui'
import './overlay.css'

export const TooltipProvider = RX.Provider

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Delay before showing, ms. Default 300. */
  delayDuration?: number
}

export function Tooltip({ content, children, side = 'top', delayDuration = 300 }: TooltipProps) {
  return (
    <RX.Root delayDuration={delayDuration}>
      <RX.Trigger asChild>{children}</RX.Trigger>
      <RX.Portal>
        <RX.Content className="rx-tooltip" side={side} sideOffset={6}>
          {content}
          <RX.Arrow className="rx-tooltip-arrow" width={10} height={5} />
        </RX.Content>
      </RX.Portal>
    </RX.Root>
  )
}
