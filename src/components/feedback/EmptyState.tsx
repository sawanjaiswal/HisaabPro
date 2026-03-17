/** EmptyState — Preset for zero-item lists/sections
 *
 * Thin wrapper over FeedbackState with teal variant defaults.
 * Accepts same API as before (icon, title, description, action, className).
 */

import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { FeedbackState } from './FeedbackState'

interface EmptyStateProps {
  /** Icon for the illustrated circle — defaults to Inbox */
  icon?: ReactNode
  title: string
  description?: string
  /** CTA button or any ReactNode */
  action?: ReactNode
  /** Extra CSS class for positioning */
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <FeedbackState
      icon={icon ?? <Inbox size={28} aria-hidden="true" />}
      variant="teal"
      title={title}
      description={description}
      action={action}
      className={className}
      role="status"
    />
  )
}
