/** Tabs — Radix Tabs re-skinned as the standard pill-tab control.
 *
 * Consolidates the hand-rolled `.pill-tabs` pattern (e.g. JournalEntriesPage)
 * into one accessible primitive with arrow-key roving focus.
 *
 *   <Tabs value={tab} onValueChange={setTab}>
 *     <TabsList>
 *       <TabsTrigger value="all">All</TabsTrigger>
 *       <TabsTrigger value="customers">Customers</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="all">…</TabsContent>
 *   </Tabs>
 */
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Tabs as RX } from 'radix-ui'
import { cn } from '@/lib/utils'
import './overlay.css'

export const Tabs = RX.Root
export const TabsContent = RX.Content

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <RX.List className={cn('rx-tabs-list', className)}>{children}</RX.List>
}

export function TabsTrigger({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RX.Trigger>) {
  return (
    <RX.Trigger className={cn('rx-tab', className)} {...props}>
      {children}
    </RX.Trigger>
  )
}
