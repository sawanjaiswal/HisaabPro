/** Grouped-list row + group — archetype H (mockups #19/74 Settings, #25 More,
 *  #96 Theme, #97 Account & Security, #32/81 Backup, and 13 more in W8b/W8c).
 *
 *  Tinted rounded-square icon · bold label · muted sub-line · right slot
 *  (chevron, a value like "Dark"/"English", or a control).
 *
 *  Promoted out of `features/settings/components/SettingsSection` once More
 *  needed the same row: sharing it from `features/settings/**` would have meant
 *  importing that feature's whole stylesheet into every consumer.
 */

import React from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import './setting-list-row.css'

export type SettingRowTone = 'primary' | 'danger' | 'warning'

interface SettingListRowProps {
  icon: React.ReactNode
  label: string
  /** Muted sub-line under the label. */
  description?: string
  /** Right-hand read-only value, e.g. "Dark", "Version 1.0.0". */
  value?: string
  /** Interactive right-hand slot (toggle, radio). Renders the row as a
   *  `<label>` so the control is not nested inside a button (WCAG 4.1.2). */
  control?: React.ReactNode
  /** Show the navigation chevron. Defaults to true when `onClick` is set and
   *  neither `value` nor `control` occupies the slot. */
  chevron?: boolean
  tone?: SettingRowTone
  onClick?: () => void
}

export const SettingListRow: React.FC<SettingListRowProps> = ({
  icon,
  label,
  description,
  value,
  control,
  chevron,
  tone = 'primary',
  onClick,
}) => {
  const showChevron = chevron ?? (Boolean(onClick) && !value && !control)
  const ariaLabel = description ? `${label}: ${description}` : label

  const body = (
    <>
      <span className={`setting-row-icon setting-row-icon--${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="setting-row-content">
        <span className="setting-row-label">{label}</span>
        {description && <span className="setting-row-description">{description}</span>}
      </span>
      <span className="setting-row-action">
        {value && <span className="setting-row-value">{value}</span>}
        {control}
        {showChevron && <ChevronRight className="setting-row-chevron" aria-hidden="true" />}
      </span>
    </>
  )

  if (control) {
    return <label className={`setting-row setting-row--${tone}`}>{body}</label>
  }

  return (
    <Button
      variant="none"
      className={`setting-row setting-row--${tone}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {body}
    </Button>
  )
}

interface SettingListGroupProps {
  /** Uppercase section label above the card. Omit for an unlabelled group. */
  title?: string
  children: React.ReactNode
}

export const SettingListGroup: React.FC<SettingListGroupProps> = ({ title, children }) => (
  <div className="setting-group-section py-0">
    {title && <p className="setting-group-title py-0">{title}</p>}
    <div className="setting-group">{children}</div>
  </div>
)
