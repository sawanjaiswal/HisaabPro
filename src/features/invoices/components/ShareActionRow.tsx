/** Single row in the share-actions list.
 *
 * Renders an icon (or spinner when loading), a label, and an optional
 * secondary line. Used exclusively by ShareInvoiceDrawer.
 */

import type { ReactNode } from 'react'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShareActionRowProps {
  /** Lucide icon element to display when not loading */
  icon: ReactNode
  /** Primary label text (e.g. "Share via WhatsApp") */
  label: string
  /** Secondary description text */
  subLabel?: string
  /** Click handler — fires async action */
  onClick: () => void
  /** When true, shows a spinner instead of the icon */
  isLoading: boolean
  /** When true, the entire row is disabled */
  disabled: boolean
  /** Accessible label for the button */
  ariaLabel: string
  /** BEM modifier for the icon container (e.g. "whatsapp", "pdf") */
  iconModifier: string
  /** Whether this is the last row (adds --last modifier) */
  isLast?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ShareActionRow({
  icon,
  label,
  subLabel,
  onClick,
  isLoading,
  disabled,
  ariaLabel,
  iconModifier,
  isLast = false,
}: ShareActionRowProps) {
  const rowClass = `share-action-row${isLast ? ' share-action-row--last' : ''}`

  return (
    <li>
      <button
        type="button"
        className={rowClass}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        <span
          className={`share-action-icon share-action-icon--${iconModifier}`}
          aria-hidden="true"
        >
          {isLoading
            ? <span className="share-action-spinner" aria-hidden="true" />
            : icon
          }
        </span>
        <span className="share-action-text">
          <span className="share-action-label">{label}</span>
          {subLabel && (
            <span className="share-action-sub">{subLabel}</span>
          )}
        </span>
      </button>
    </li>
  )
}
