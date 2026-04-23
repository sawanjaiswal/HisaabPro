/** Dashboard — Quick action grid (4 columns)
 *
 * Figma: white rounded boxes with icons inside, labels below.
 * Renders SVG assets for legacy tiles, Lucide components for the rest.
 */

import React from 'react'
import { BarChart3, CreditCard, MoreHorizontal, Package, Send, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { QuickActionConfig } from '../dashboard.constants'

interface DashboardQuickActionsProps {
  actions: QuickActionConfig[]
  onAction: (route: string) => void
}

const FIGMA_ICONS: Record<string, string> = {
  'send-invoice': '/assets/icon-send.svg',
  'record-payment': '/assets/icon-pay.svg',
  'more-actions': '/assets/icon-more.svg',
}

const LUCIDE_ICONS: Record<string, LucideIcon> = {
  BarChart3,
  CreditCard,
  MoreHorizontal,
  Package,
  Send,
  FileText,
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
        const iconSrc = FIGMA_ICONS[action.id]
        const LucideComp = LUCIDE_ICONS[action.icon]
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
              {iconSrc ? (
                <img src={iconSrc} alt="" width={24} height={24} aria-hidden="true" />
              ) : LucideComp ? (
                <LucideComp size={24} aria-hidden="true" />
              ) : null}
            </div>
            <span className="dashboard-action-label">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
