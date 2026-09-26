/** Godowns — Main page (lazy loaded) */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Warehouse } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
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
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'

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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.GODOWN_TRANSFER)} aria-label={t.transferStock}>
              {t.transfer}
            </Button>
            <Button variant="ghost" size="sm" onClick={goToCreate} aria-label={t.addNewGodown}>
              <Plus size={20} aria-hidden="true" />
            </Button>
          </div>
        }
      />

      <HeroPage className="space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as GodownTab)}>
          <TabsList variant="line" aria-label={t.godownSections}>
            {GODOWN_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

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
                    <Button variant="primary" size="md" onClick={goToCreate} aria-label={t.addFirstGodown}>
                      {t.addGodown}
                    </Button>
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
      </HeroPage>


    </AppShell>
  )
}
