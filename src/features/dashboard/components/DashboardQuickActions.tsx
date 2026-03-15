/** Dashboard — Quick action grid (4 columns)
 *
 * Figma: white rounded boxes (18px radius) with icons inside,
 * labels below. 4-column grid layout.
 */

import React from 'react'
import { FileText, Banknote, Package, Users, MoreHorizontal, Send, Upload, CreditCard } from 'lucide-react'
import type { QuickAction } from '../dashboard.types'

interface DashboardQuickActionsProps {
  actions: QuickAction[]
  onAction: (route: string) => void
}

const ICON_MAP: Record<string, React.FC<{ size?: number; 'aria-hidden'?: boolean }>> = {
  FileText,
  Banknote,
  Package,
  Users,
  MoreHorizontal,
  Send,
  Upload,
  CreditCard,
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
        const IconComponent = ICON_MAP[action.icon]

        return (
          <button
            key={action.id}
            className="dashboard-action-item"
            role="listitem"
            onClick={() => onAction(action.route)}
            aria-label={action.label}
          >
            <div className="dashboard-action-icon-box">
              {IconComponent !== undefined && (
                <IconComponent size={24} aria-hidden={true} />
              )}
            </div>
            <span className="dashboard-action-label">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}
