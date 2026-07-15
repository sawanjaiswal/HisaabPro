/** Dashboard — Top Priorities card
 *
 * Mockup: white card overlapping the hero, listing up to 3 actionable rows
 * with a dedicated outline-button CTA per row (Remind / Order Now / Review).
 * Rows are built by buildTopPriorities() from data already in
 * HomeDashboardData — no invented fields (e.g. no staff-cash-submission row).
 */

import React from 'react'
import { IndianRupee, Package, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import type { PriorityItem } from '../dashboard.types'

interface TopPrioritiesCardProps {
  items: PriorityItem[]
  onViewAll: () => void
  onItemAction: (item: PriorityItem) => void
}

const ICONS: Record<string, LucideIcon> = { IndianRupee, Package, FileText }

export const TopPrioritiesCard: React.FC<TopPrioritiesCardProps> = ({
  items,
  onViewAll,
  onItemAction,
}) => {
  const { t } = useLanguage()

  if (items.length === 0) return null

  return (
    <div className="dashboard-priorities-card">
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">{t.topPriorities}</h2>
        <Button variant="none" className="dashboard-section-link" onClick={onViewAll}>
          {t.viewAllPriorities.replace('{count}', String(items.length))}
        </Button>
      </div>

      <ul className="dashboard-priorities-list" role="list">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? IndianRupee
          const title = item.title ?? (item.titleKey ? t[item.titleKey] : '')
          return (
            <li key={item.id} className={`dashboard-priority-row dashboard-priority-row--${item.tone}`}>
              <div className="dashboard-priority-icon" aria-hidden="true">
                <Icon size={18} />
              </div>
              <div className="dashboard-priority-info">
                <p className="dashboard-priority-title">{title}</p>
                <p className="dashboard-priority-subtitle">{item.subtitle}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="dashboard-priority-action"
                onClick={() => onItemAction(item)}
              >
                {t[item.actionLabelKey]}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
