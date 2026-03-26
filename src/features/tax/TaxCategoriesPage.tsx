/** Tax — Tax Categories list page (lazy loaded)
 *
 * Shows all tax categories for the business.
 * Clicking a card navigates to edit. FAB for create.
 * 4 UI states: loading / error / empty / success
 */

import { useNavigate } from 'react-router-dom'
import { Plus, Receipt } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useTaxCategories } from './useTaxCategories'
import { TaxCategoryCard } from './components/TaxCategoryCard'
import { TaxCategoriesSkeleton } from './components/TaxCategoriesSkeleton'
import './tax-categories.css'

export default function TaxCategoriesPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { categories, status, refresh, seedDefaults } = useTaxCategories(businessId)

  return (
    <AppShell>
      <Header title={t.taxRates} backTo={ROUTES.SETTINGS_GST} />

      <PageContainer>
        <div className="tax-cat-page">
          {status === 'loading' && <TaxCategoriesSkeleton />}

          {status === 'error' && (
            <ErrorState title={t.couldNotLoadTaxCategories} message={t.checkConnectionRetry} onRetry={refresh} />
          )}

          {status === 'success' && categories.length === 0 && (
            <EmptyState
              icon={<Receipt size={40} aria-hidden="true" />}
              title={t.noTaxCategories}
              description={t.noTaxCategoriesDesc}
              action={
                <div className="tax-cat-empty-actions">
                  <button className="btn btn-primary btn-md" onClick={() => seedDefaults(businessId)} aria-label={t.seedDefaultGstRates}>{t.seedDefaults}</button>
                  <button className="btn btn-outline btn-md" onClick={() => navigate(ROUTES.SETTINGS_TAX_RATE_NEW)} aria-label={t.createCustomTaxRate}>{t.create}</button>
                </div>
              }
            />
          )}

          {status === 'success' && categories.length > 0 && (
            <div className="tax-cat-list" role="list" aria-label={t.taxCategoriesList}>
              {categories.map((cat) => (
                <div key={cat.id} role="listitem">
                  <TaxCategoryCard category={cat} onClick={(id) => navigate(ROUTES.SETTINGS_TAX_RATE_EDIT.replace(':id', id))} />
                </div>
              ))}
            </div>
          )}
        </div>
      </PageContainer>

      <button className="fab" onClick={() => navigate(ROUTES.SETTINGS_TAX_RATE_NEW)} aria-label={t.createNewTaxRate}>
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
