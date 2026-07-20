/** Reports hub — Favourites list under the category grid (mockup #14).
 *
 * States: hydrating (skeleton row), empty (hint pointing at Edit), success
 * (tinted icon rows with a filled star). There is no error state — the read
 * is local and degrades to empty by design.
 */

import { Star } from 'lucide-react'
import type React from 'react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { reportIcon } from '../report-hub.icons'
import type { ReportCategory } from '../report.types'

interface ReportFavouritesSectionProps {
  favourites: ReportCategory[]
  hydrated: boolean
  editing: boolean
  onToggleEditing: () => void
  onOpen: (route: string) => void
}

export function ReportFavouritesSection({
  favourites,
  hydrated,
  editing,
  onToggleEditing,
  onOpen,
}: ReportFavouritesSectionProps) {
  const { t } = useLanguage()

  return (
    <section className="report-hub-section py-0" aria-label={t.favourites}>
      <div className="report-hub-section-head">
        <h2 className="report-hub-section-title">{t.favourites}</h2>
        <Button
          variant="none"
          type="button"
          className="report-hub-section-action"
          onClick={onToggleEditing}
        >
          {editing ? t.done : t.edit}
        </Button>
      </div>

      {!hydrated && (
        <div className="report-fav-skeleton animate-pulse" aria-hidden="true">
          <span className="report-fav-skeleton-icon" />
          <span className="report-fav-skeleton-line" />
        </div>
      )}

      {hydrated && favourites.length === 0 && (
        <div className="report-fav-empty">
          <span className="report-fav-empty-title">{t.noFavouriteReports}</span>
          <span className="report-fav-empty-sub">{t.tapEditToAddFavourites}</span>
        </div>
      )}

      {hydrated && favourites.length > 0 && (
        <ul className="report-fav-list">
          {favourites.map((category) => {
            const Icon = reportIcon(category.icon)

            return (
              <li key={category.id}>
                <Button
                  variant="none"
                  type="button"
                  className="report-fav-row"
                  aria-label={`${t.viewReport} ${t[category.titleKey]}`}
                  onClick={() => onOpen(category.route)}
                  style={
                    { '--report-accent-color': category.color } as React.CSSProperties
                  }
                >
                  <span className="report-category-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="report-fav-row-text">
                    <span className="report-category-title">{t[category.titleKey]}</span>
                    <span className="report-category-desc">{t[category.descKey]}</span>
                  </span>
                  <span className="report-fav-row-star" aria-hidden="true">
                    <Star size={16} fill="currentColor" />
                  </span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
