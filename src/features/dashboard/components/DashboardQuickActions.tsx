/** Dashboard — Quick action pill row
 *
 * Horizontally scrollable pills. Each pill has an icon + label with a
 * CSS-variable color from the action config. Uses QUICK_ACTIONS from constants.
 * Icon names are resolved to lucide-react components via a static map to keep
 * the bundle treeshakable — no dynamic require.
 */

import React from 'react'
import { FileText, Banknote, Package, Users } from 'lucide-react'
import type { QuickAction } from '../dashboard.types'

interface DashboardQuickActionsProps {
  actions: QuickAction[]
  onAction: (route: string) => void
}

/** Static map from icon name string → lucide component.
 *  Only icons used in QUICK_ACTIONS are included — keeps bundle lean.
 */
const ICON_MAP: Record<string, React.FC<{ size?: number; 'aria-hidden'?: boolean }>> = {
  FileText,
  Banknote,
  Package,
  Users,
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  actions,
  onAction,
}) => {
  return (
    <div
      className="dashboard-quick-actions"
      role="list"
      aria-label="Quick actions"
    >
      {actions.map((action) => {
        const IconComponent = ICON_MAP[action.icon]

        return (
          <button
            key={action.id}
            className="dashboard-quick-action"
            role="listitem"
            style={{ background: action.color }}
            onClick={() => onAction(action.route)}
            aria-label={action.label}
          >
            {IconComponent !== undefined && (
              <span className="dashboard-quick-action-icon">
                <IconComponent size={16} aria-hidden={true} />
              </span>
            )}
            {action.label}
          </button>
        )
      })}
    </div>
  )
}
