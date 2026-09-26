/** Tabs — shadcn UI Radix Tabs primitive.
 *
 * Provides segmented, underline, and pills tab controls for the design system.
 * Full keyboard arrow-key navigation and screen-reader accessibility via Radix.
 *
 * Usage:
 *   <Tabs value={activeTab} onValueChange={setActiveTab}>
 *     <TabsList variant="segmented" fullWidth>
 *       <TabsTrigger value="ledger" icon={<List size={16} />}>Ledger</TabsTrigger>
 *       <TabsTrigger value="invoices" badge={3}>Invoices</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="ledger">…</TabsContent>
 *   </Tabs>
 */

import * as React from 'react'
import { Tabs as RX } from 'radix-ui'
import { cn } from '@/lib/utils'
import './tabs.css'

/** 'line' = shadcn underline style: bold active label + 2px emerald bottom border.
 *  'underline' kept as alias for backward compatibility.
 *  'segmented' = filled pill group (existing default).
 *  'pills' = outlined pill tabs.
 */
export type TabsVariant = 'segmented' | 'underline' | 'line' | 'pills'

export const Tabs = RX.Root

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof RX.List> {
  variant?: TabsVariant
  fullWidth?: boolean
}

export const TabsList = React.forwardRef<
  React.ElementRef<typeof RX.List>,
  TabsListProps
>(({ className, variant = 'segmented', fullWidth = false, ...props }, ref) => (
  <RX.List
    ref={ref}
    className={cn(
      'ui-tabs-list',
      `ui-tabs-list--${variant}`,
      fullWidth && 'ui-tabs-list--full-width',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof RX.Trigger> {
  icon?: React.ReactNode
  badge?: string | number
}

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RX.Trigger>,
  TabsTriggerProps
>(({ className, children, icon, badge, ...props }, ref) => (
  <RX.Trigger
    ref={ref}
    className={cn('ui-tabs-trigger', className)}
    {...props}
  >
    {icon && <span className="ui-tabs-icon" aria-hidden="true">{icon}</span>}
    <span>{children}</span>
    {badge != null && <span className="ui-tabs-badge">{badge}</span>}
  </RX.Trigger>
))
TabsTrigger.displayName = 'TabsTrigger'

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof RX.Content>,
  React.ComponentPropsWithoutRef<typeof RX.Content>
>(({ className, ...props }, ref) => (
  <RX.Content
    ref={ref}
    className={cn('ui-tabs-content', className)}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'
