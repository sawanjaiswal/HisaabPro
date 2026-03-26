/** Godowns — Main page (lazy loaded) */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Warehouse } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useGodowns } from './useGodowns'
import { GodownCard } from './components/GodownCard'
import { TransferHistory } from './components/TransferHistory'
import { GODOWN_TABS } from './godown.constants'
import type { GodownTab } from './godown.constants'
import './godowns.css'

export default function GodownsPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { data, status, refetch } = useGodowns()
  const [activeTab, setActiveTab] = useState<GodownTab>('godowns')

  const handleCardClick = (id: string) => navigate(ROUTES.GODOWN_DETAIL.replace(':id', id))
  const goToCreate = () => navigate(ROUTES.GODOWN_NEW)

  return (
    <AppShell>
      <Header
        title={t.godownsList}
        actions={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(ROUTES.GODOWN_TRANSFER)} aria-label={t.transferStock}>
            {t.transfer}
          </button>
        }
      />

      <PageContainer>
        <nav className="pill-tabs" role="tablist" aria-label={t.godownSections}>
          {GODOWN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={`pill-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-selected={activeTab === tab.id}
              aria-controls={`godown-panel-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div id={`godown-panel-${activeTab}`} role="tabpanel" aria-label={activeTab}>
          {activeTab === 'godowns' && (
            <>
              {status === 'loading' && (
                <div className="godown-skeleton-list">
                  <Skeleton height="4.5rem" count={4} />
                </div>
              )}

              {status === 'error' && (
                <ErrorState
                  title={t.couldNotLoadGodowns}
                  message={t.checkConnectionRetry}
                  onRetry={refetch}
                />
              )}

              {status === 'success' && data && data.godowns.length === 0 && (
                <EmptyState
                  icon={<Warehouse size={40} aria-hidden="true" />}
                  title={t.noGodownsYet}
                  description={t.addFirstGodownDesc}
                  action={
                    <button className="btn btn-primary btn-md" onClick={goToCreate} aria-label={t.addFirstGodown}>
                      {t.addGodown}
                    </button>
                  }
                />
              )}

              {status === 'success' && data && data.godowns.length > 0 && (
                <>
                  <div role="status" aria-live="polite" className="sr-only">
                    {data.godowns.length} {data.godowns.length === 1 ? t.godownFound : t.godownsFoundPlural} {t.found}
                  </div>
                  <div className="godown-list stagger-list" role="list" aria-label={t.godownsList}>
                    {data.godowns.map((godown) => (
                      <div key={godown.id} className="godown-list-item" role="listitem">
                        <GodownCard godown={godown} onClick={handleCardClick} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'transfers' && <TransferHistory />}
        </div>
      </PageContainer>

      {activeTab === 'godowns' && (
        <button className="fab" onClick={goToCreate} aria-label={t.addNewGodown}>
          <Plus size={24} aria-hidden="true" />
        </button>
      )}
    </AppShell>
  )
}
