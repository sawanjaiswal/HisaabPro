/** Dashboard — Quick action grid (4 columns)
 *
 * Figma: white rounded boxes with SVG icons inside,
 * labels below. Create, Send, Pay, More.
 */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { QuickActionConfig } from '../dashboard.constants'

interface DashboardQuickActionsProps {
  actions: QuickActionConfig[]
  onAction: (route: string) => void
}

const FIGMA_ICONS: Record<string, string> = {
  'new-invoice': '/assets/icon-create.svg',
  'send-invoice': '/assets/icon-send.svg',
  'record-payment': '/assets/icon-pay.svg',
  'more-actions': '/assets/icon-more.svg',
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  actions,
  onAction,
}) => {
  const { t } = useLanguage()
  return (
    <div
      className="dashboard-action-grid"
      role="list"
      aria-label={t.quickActions}
    >
      {actions.map((action) => {
        const iconSrc = FIGMA_ICONS[action.id] ?? '/assets/icon-more.svg'
        const label = t[action.labelKey]

        return (
          <button
            key={action.id}
            className="dashboard-action-item"
            role="listitem"
            onClick={() => onAction(action.route)}
            aria-label={label}
          >
            <div className="dashboard-action-icon-box">
              <img src={iconSrc} alt="" width={24} height={24} aria-hidden="true" />
            </div>
            <span className="dashboard-action-label">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
