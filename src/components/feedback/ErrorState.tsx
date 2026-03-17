/** ErrorState — Preset for API/load failures
 *
 * Thin wrapper over FeedbackState with error variant.
 * Supports custom icon, custom action, or simple onRetry shortcut.
 */

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { FeedbackState } from './FeedbackState'

interface ErrorStateProps {
  /** Custom icon — defaults to AlertTriangle */
  icon?: ReactNode
  title?: string
  message?: string
  /** Simple retry callback — renders a "Try Again" button */
  onRetry?: () => void
  /** Custom retry button label */
  retryLabel?: string
  /** Full custom action — overrides onRetry if both provided */
  action?: ReactNode
  /** Extra CSS class for positioning */
  className?: string
}

export function ErrorState({
  icon,
  title = 'Something went wrong',
  message = 'Please try again. If the problem persists, contact support.',
  onRetry,
  retryLabel = 'Try Again',
  action,
  className,
}: ErrorStateProps) {
  const resolvedAction = action ?? (onRetry ? (
    <button className="feedback-btn feedback-btn--primary" onClick={onRetry} aria-label={retryLabel}>
      {retryLabel}
    </button>
  ) : undefined)

  return (
    <FeedbackState
      icon={icon ?? <AlertTriangle size={28} aria-hidden="true" />}
      variant="error"
      title={title}
      description={message}
      action={resolvedAction}
      className={className}
      role="alert"
    />
  )
}
