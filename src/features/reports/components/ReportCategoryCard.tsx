/** Reports hub — one category card in the 2-up grid (mockup #14).
 *
 * Two modes: normal (tap opens the report) and editing (tap toggles the
 * favourite star). The star is rendered as an indicator, never a nested
 * button — a button inside a button is invalid and breaks keyboard nav.
 */

import type React from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { reportIcon } from '../report-hub.icons'
import type { ReportCategory } from '../report.types'

interface ReportCategoryCardProps {
  category: ReportCategory
  editing: boolean
  isFavourite: boolean
  onOpen: (route: string) => void
  onToggleFavourite: (id: string) => void
}

export function ReportCategoryCard({
  category,
  editing,
  isFavourite,
  onOpen,
  onToggleFavourite,
}: ReportCategoryCardProps) {
  const { t } = useLanguage()
  const Icon = reportIcon(category.icon)
  const title = t[category.titleKey]

  const label = editing
    ? `${isFavourite ? t.removeFromFavourites : t.addToFavourites} — ${title}`
    : `${t.viewReport} ${title}`

  return (
    <Button
      variant="none"
      type="button"
      className="report-category-card"
      aria-label={label}
      aria-pressed={editing ? isFavourite : undefined}
      onClick={() =>
        editing ? onToggleFavourite(category.id) : onOpen(category.route)
      }
      style={{ '--report-accent-color': category.color } as React.CSSProperties}
    >
      <div className="report-category-icon" aria-hidden="true">
        <Icon size={22} />
      </div>

      <div className="report-category-text">
        <div className="report-category-title">{title}</div>
        <div className="report-category-desc">{t[category.descKey]}</div>
      </div>

      {editing && (
        <span
          className={`report-category-star${isFavourite ? ' is-on' : ''}`}
          aria-hidden="true"
        >
          <Star size={16} fill={isFavourite ? 'currentColor' : 'none'} />
        </span>
      )}
    </Button>
  )
}
