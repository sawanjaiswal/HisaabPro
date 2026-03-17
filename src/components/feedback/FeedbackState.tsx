/** FeedbackState — Base composable component for all feedback UI
 *
 * Single reusable building block. EmptyState, ErrorState, NetworkError
 * are thin presets over this. Any feature can use FeedbackState directly
 * for custom feedback screens.
 *
 * @example
 * <FeedbackState
 *   icon={<Package size={32} />}
 *   variant="warning"
 *   title="Low stock"
 *   description="3 products need restocking."
 *   action={<button onClick={restock}>Restock Now</button>}
 * />
 */

import type { ReactNode } from 'react'
import './feedback-state.css'
import './feedback-illustration.css'

export type FeedbackVariant = 'teal' | 'error' | 'warning' | 'success'

interface FeedbackStateProps {
  /** Icon displayed inside the illustrated circle */
  icon?: ReactNode
  /** Color scheme: teal (default/empty), error (failures), warning (network/alerts), success */
  variant?: FeedbackVariant
  /** Primary heading */
  title: string
  /** Secondary description text */
  description?: string
  /** Content rendered between illustration and title (e.g. "404" code) */
  subtitle?: ReactNode
  /** Action area — buttons, links, any ReactNode */
  action?: ReactNode
  /** Additional CSS class for positioning/spacing overrides */
  className?: string
  /** ARIA role — defaults to 'status', use 'alert' for errors */
  role?: 'status' | 'alert'
  /** Size — 'md' (default, inline) or 'lg' (full-page like 404) */
  size?: 'md' | 'lg'
}

export function FeedbackState({
  icon,
  variant = 'teal',
  title,
  description,
  subtitle,
  action,
  className,
  role = 'status',
  size = 'md',
}: FeedbackStateProps) {
  const rootClass = [
    'feedback-state',
    size === 'lg' && 'feedback-state--lg',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClass} role={role}>
      {/* Illustrated icon circle with decorative ring */}
      <div className={`feedback-illustration feedback-illustration--${size}`}>
        <div className={`feedback-ring feedback-ring--${variant}`} aria-hidden="true" />
        {variant === 'warning' && (
          <div className="feedback-pulse" aria-hidden="true" />
        )}
        <div className={`feedback-icon-circle feedback-icon-circle--${variant}`}>
          {icon}
        </div>
      </div>

      {subtitle}
      <h3 className={`feedback-title${size === 'lg' ? ' feedback-title--lg' : ''}`}>{title}</h3>
      {description && <p className="feedback-description">{description}</p>}
      {action && <div className="feedback-action">{action}</div>}
    </div>
  )
}
