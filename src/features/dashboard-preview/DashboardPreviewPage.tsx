import { AppShell } from '@/components/layout/AppShell'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { useHomeDashboard } from '../dashboard/useDashboard'
import { DashboardSkeleton } from '../dashboard/components/DashboardSkeleton'
import { DashboardHeader } from '../dashboard/components/DashboardHeader'
import { DashboardViewSwitcher } from './components/DashboardViewSwitcher'
import { PreviewExecutiveHero } from './components/PreviewExecutiveHero'
import { PreviewQuickDock } from './components/PreviewQuickDock'
import { PreviewActionableRail } from './components/PreviewActionableRail'
import { PreviewActivityStream } from './components/PreviewActivityStream'
import './dashboard-preview.css'

export default function DashboardPreviewPage() {
  const { t } = useLanguage()
  const { data, status, refresh } = useHomeDashboard()

  return (
    <AppShell>
      <DashboardViewSwitcher />
      <DashboardHeader />

      <main className="dash-preview-page">
        {status === 'loading' && <DashboardSkeleton />}

        {status === 'error' && (
          <ErrorState
            title={t.dashboardErrorTitle}
            message={t.dashboardErrorMsg}
            onRetry={refresh}
          />
        )}

        {status === 'success' && data && (
          <>
            <PreviewExecutiveHero data={data} />
            <PreviewQuickDock />
            <PreviewActionableRail data={data} />
            <PreviewActivityStream items={data.recentActivity} />
          </>
        )}
      </main>
    </AppShell>
  )
}
