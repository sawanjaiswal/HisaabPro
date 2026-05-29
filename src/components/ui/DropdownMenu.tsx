/** DropdownMenu — Radix dropdown re-skinned with design tokens.
 *
 * Replaces the ~22 ad-hoc dropdowns flagged in the components audit.
 * Focus, keyboard nav, type-ahead, portalling and outside-click are
 * handled by Radix; we only supply the skin (overlay.css).
 *
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild><Button>Actions</Button></DropdownMenuTrigger>
 *     <DropdownMenuContent>
 *       <DropdownMenuItem onSelect={…}>Edit</DropdownMenuItem>
 *       <DropdownMenuSeparator />
 *       <DropdownMenuItem danger onSelect={…}>Delete</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { DropdownMenu as RX } from 'radix-ui'
import { cn } from '@/lib/utils'
import './overlay.css'

export const DropdownMenu = RX.Root
export const DropdownMenuTrigger = RX.Trigger

export function DropdownMenuContent({
  children,
  align = 'end',
  sideOffset = 6,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RX.Content>) {
  return (
    <RX.Portal>
      <RX.Content
        align={align}
        sideOffset={sideOffset}
        className={cn('rx-surface', className)}
        {...props}
      >
        {children}
      </RX.Content>
    </RX.Portal>
  )
}

interface ItemProps extends ComponentPropsWithoutRef<typeof RX.Item> {
  danger?: boolean
  children: ReactNode
}

export function DropdownMenuItem({ danger, className, children, ...props }: ItemProps) {
  return (
    <RX.Item className={cn('rx-item', danger && 'rx-item--danger', className)} {...props}>
      {children}
    </RX.Item>
  )
}

export function DropdownMenuSeparator() {
  return <RX.Separator className="rx-separator" />
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <RX.Label className="rx-label">{children}</RX.Label>
}
