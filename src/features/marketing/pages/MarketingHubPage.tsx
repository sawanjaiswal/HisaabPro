/** MarketingHubPage — /marketing — landing with quick stats and CTAs */

import { useNavigate } from 'react-router-dom'
import { Send, FileText, Bell, ShieldOff } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/hooks/useLanguage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { MARKETING_ROUTES } from '../marketing.constants'
import { listCampaigns, listTemplates, listReminderRules } from '../marketing.service'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'

function StatCard({ label, value, loading }: { label: string; value: number | string; loading?: boolean }) {
  return (
    <Card className="flex-1 min-w-[120px] p-4 rounded-xl border border-border bg-card shadow-2xs">
      <div className="text-xl font-bold text-[var(--text-primary)]">
        {loading ? <Skeleton className="w-10 h-6 rounded-md inline-block" /> : value}
      </div>
      <div className="text-xs text-[var(--text-muted)] mt-1">{label}</div>
    </Card>
  )
}

interface NavTileProps {
  icon: React.ReactNode
  title: string
  description: string
  route: string
  color: string
  cta: string
}

function NavTile({ icon, title, description, route, color, cta }: NavTileProps) {
  const navigate = useNavigate()
  return (
    <Card
      clickable
      hover
      onClick={() => navigate(route)}
      className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card shadow-2xs text-left flex-1 min-w-[140px]"
    >
      <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: color }}>
        {icon}
      </span>
      <div>
        <div className="font-bold text-sm text-[var(--text-primary)]">{title}</div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{description}</div>
      </div>
      <span className="text-xs font-semibold text-primary mt-auto">{cta} →</span>
    </Card>
  )
}

export default function MarketingHubPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const campaignQuery = useQuery({
    queryKey: ['marketing', 'campaigns', 'list', ''],
    queryFn: ({ signal }) => listCampaigns(undefined, null, signal),
    staleTime: 60_000,
  })

  const templateQuery = useQuery({
    queryKey: ['marketing', 'templates', 'list', undefined],
    queryFn: ({ signal }) => listTemplates(undefined, null, signal),
    staleTime: 60_000,
  })

  const reminderQuery = useQuery({
    queryKey: ['marketing', 'reminder-rules', 'list', true],
    queryFn: ({ signal }) => listReminderRules(true, null, signal),
    staleTime: 60_000,
  })

  const loading = campaignQuery.isPending || templateQuery.isPending || reminderQuery.isPending
  const hasError = campaignQuery.isError && templateQuery.isError && reminderQuery.isError
  const retryAll = () => {
    void campaignQuery.refetch()
    void templateQuery.refetch()
    void reminderQuery.refetch()
  }
  const campaigns = campaignQuery.data?.data ?? []
  const templates = templateQuery.data?.data ?? []
  const rules = reminderQuery.data?.data ?? []
  const activeReminders = rules.filter((r) => r.enabled).length

  return (
    <AppShell
      header={
        <Header
          title={t.marketing}
          subtitle={t.marketingSubtitle}
          backTo={true}
        />
      }
    >
      <PageContainer className="py-4 pb-24 max-w-2xl mx-auto space-y-6">
        {/* Stats / error */}
        {hasError ? (
          <ErrorState title={t.marketingOptOutsLoadFailed} onRetry={retryAll} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <StatCard label={t.marketingCampaigns} value={campaigns.length} loading={loading} />
            <StatCard label={t.marketingTemplates} value={templates.length} loading={loading} />
            <StatCard label={t.marketingActiveReminders} value={activeReminders} loading={loading} />
          </div>
        )}

        {/* Quick actions */}
        <div>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_NEW)}
          >
            {t.marketingNewCampaign}
          </Button>
        </div>

        {/* Nav tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NavTile
            icon={<Send size={20} className="text-primary" aria-hidden="true" />}
            title={t.marketingCampaigns}
            description={t.marketingCampaignsDesc}
            route={MARKETING_ROUTES.CAMPAIGNS}
            color="var(--color-primary-50)"
            cta={t.marketingViewAll}
          />
          <NavTile
            icon={<FileText size={20} color="var(--color-secondary-600, #7c3aed)" aria-hidden="true" />}
            title={t.marketingTemplatesNav}
            description={t.marketingTemplatesDesc}
            route={MARKETING_ROUTES.TEMPLATES}
            color="var(--color-secondary-50, #f5f3ff)"
            cta={t.marketingManage}
          />
          <NavTile
            icon={<Bell size={20} color="var(--color-warning-600, #d97706)" aria-hidden="true" />}
            title={t.marketingReminders}
            description={t.marketingRemindersDesc}
            route={MARKETING_ROUTES.REMINDERS}
            color="var(--color-warning-50, #fffbeb)"
            cta={t.marketingSetUp}
          />
          <NavTile
            icon={<ShieldOff size={20} color="var(--color-error-600, var(--color-error-600))" aria-hidden="true" />}
            title={t.marketingOptOuts}
            description={t.marketingOptOutsDesc}
            route={MARKETING_ROUTES.OPT_OUTS}
            color="var(--color-error-50, var(--color-error-50))"
            cta={t.marketingView}
          />
        </div>
      </PageContainer>
    </AppShell>
  )
}
