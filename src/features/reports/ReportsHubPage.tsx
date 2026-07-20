/** Reports Hub — landing page for all report categories (lazy loaded).
 *
 * Mockup #14: emerald hero band with a one-line subtitle, white sheet with a
 * 2-up category grid, then a Favourites section with an Edit toggle.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { REPORT_CATEGORIES } from './report.categories'
import { useReportFavourites } from './useReportFavourites'
import { ReportCategoryCard } from './components/ReportCategoryCard'
import { ReportFavouritesSection } from './components/ReportFavouritesSection'
import './report-hub.css'

export default function ReportsHubPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const { favourites, hydrated, isFavourite, toggleFavourite } = useReportFavourites()

  const hero = (
    <p className="report-hub-hero-sub">{t.exploreBusinessInsights}</p>
  )

  return (
    <AppShell>
      <Header title={t.reports} backTo={ROUTES.DASHBOARD} />

      <HeroPage hero={hero}>
        <PageContainer variant="dashboard" className="space-y-6">
          <section className="report-hub-section py-0" aria-label={t.reportsOverview}>
            <div className="report-hub-grid stagger-list">
              {REPORT_CATEGORIES.map((category) => (
                <ReportCategoryCard
                  key={category.id}
                  category={category}
                  editing={editing}
                  isFavourite={isFavourite(category.id)}
                  onOpen={(route) => navigate(route)}
                  onToggleFavourite={toggleFavourite}
                />
              ))}
            </div>
          </section>

          <ReportFavouritesSection
            favourites={favourites}
            hydrated={hydrated}
            editing={editing}
            onToggleEditing={() => setEditing((v) => !v)}
            onOpen={(route) => navigate(route)}
          />
        </PageContainer>
      </HeroPage>
    </AppShell>
  )
}
