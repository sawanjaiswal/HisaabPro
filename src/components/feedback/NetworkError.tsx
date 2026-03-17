/** NetworkError — Preset for connection failures
 *
 * Thin wrapper over FeedbackState with warning variant.
 * Shows cloud-off icon + specific guidance + retry.
 */

import type { ReactNode } from 'react'
import { WifiOff } from 'lucide-react'
import { FeedbackState } from './FeedbackState'

interface NetworkErrorProps {
  /** Custom icon — defaults to WifiOff */
  icon?: ReactNode
  title?: string
  message?: string
  /** Simple retry callback — renders a "Retry" button */
  onRetry?: () => void
  /** Custom retry button label */
  retryLabel?: string
  /** Full custom action — overrides onRetry if both provided */
  action?: ReactNode
  /** Extra CSS class for positioning */
  className?: string
}

export function NetworkError({
  icon,
  title = 'No internet connection',
  message = 'Check your Wi-Fi or mobile data and try again.',
  onRetry,
  retryLabel = 'Retry',
  action,
  className,
}: NetworkErrorProps) {
  const resolvedAction = action ?? (onRetry ? (
    <button className="feedback-btn feedback-btn--primary" onClick={onRetry} aria-label={retryLabel}>
      {retryLabel}
    </button>
  ) : undefined)

  return (
    <FeedbackState
      icon={icon ?? <WifiOff size={28} aria-hidden="true" />}
      variant="warning"
      title={title}
      description={message}
      action={resolvedAction}
      className={className}
      role="alert"
    />
  )
}
