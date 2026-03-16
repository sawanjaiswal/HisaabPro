/** Dashboard — Quick action grid (4 columns)
 *
 * Figma: white rounded boxes with SVG icons inside,
 * labels below. Create, Send, Pay, More.
 */

import React from 'react'
import type { QuickAction } from '../dashboard.types'

interface DashboardQuickActionsProps {
  actions: QuickAction[]
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
  return (
    <div
      className="dashboard-action-grid"
      role="list"
      aria-label="Quick actions"
    >
      {actions.map((action) => {
        const iconSrc = FIGMA_ICONS[action.id] ?? '/assets/icon-more.svg'

        return (
          <button
            key={action.id}
            className="dashboard-action-item"
            role="listitem"
            onClick={() => onAction(action.route)}
            aria-label={action.label}
          >
            <div className="dashboard-action-icon-box">
              <img src={iconSrc} alt="" width={24} height={24} aria-hidden="true" />
            </div>
            <span className="dashboard-action-label">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}
