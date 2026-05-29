/** Popover — Radix Popover re-skinned with design tokens.
 *
 *   <Popover>
 *     <PopoverTrigger asChild><Button>Filters</Button></PopoverTrigger>
 *     <PopoverContent>…rich content…</PopoverContent>
 *   </Popover>
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Popover as RX } from 'radix-ui'
import { cn } from '@/lib/utils'
import './overlay.css'

export const Popover = RX.Root
export const PopoverTrigger = RX.Trigger
export const PopoverClose = RX.Close

export function PopoverContent({
  children,
  align = 'center',
  sideOffset = 8,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RX.Content> & { children: ReactNode }) {
  return (
    <RX.Portal>
      <RX.Content
        align={align}
        sideOffset={sideOffset}
        className={cn('rx-surface rx-surface--popover', className)}
        {...props}
      >
        {children}
      </RX.Content>
    </RX.Portal>
  )
}
