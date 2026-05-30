/** MarketingHubPage — /marketing — landing with quick stats and CTAs */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, FileText, Bell, ShieldOff } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/hooks/useLanguage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { MARKETING_ROUTES } from '../marketing.constants'
import { listCampaigns, listTemplates, listReminderRules } from '../marketing.service'

function StatCard({ label, value, loading }: { label: string; value: number | string; loading?: boolean }) {
  return (
    <div style={{
      flex: '1 1 120px',
      minWidth: 0,
      padding: '16px',
      borderRadius: '12px',
      background: 'white',
      border: '1px solid var(--color-gray-200)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-gray-900)' }}>
        {loading ? <span style={{ display: 'inline-block', width: 40, height: 24, borderRadius: 6, background: 'var(--color-gray-100)', animation: 'pulse 1.5s infinite' }} /> : value}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-gray-500)', marginTop: '4px' }}>{label}</div>
    </div>
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
    <button
      type="button"
      onClick={() => navigate(route)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '16px',
        borderRadius: '14px',
        background: 'white',
        border: '1px solid var(--color-gray-200)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        textAlign: 'left',
        cursor: 'pointer',
        flex: '1 1 140px',
        minWidth: 0,
      }}
    >
      <span style={{ width: 40, height: 40, borderRadius: '10px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      <div>
        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-gray-800)' }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-gray-500)', marginTop: '2px' }}>{description}</div>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-primary-600)', marginTop: 'auto' }}>{cta} →</span>
    </button>
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
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label={t.marketingBack}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>{t.marketing}</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-gray-500)', margin: 0 }}>{t.marketingSubtitle}</p>
        </div>
      </div>

      {/* Stats / error */}
      {hasError ? (
        <div style={{ marginBottom: '24px' }}>
          <ErrorState title={t.marketingOptOutsLoadFailed} onRetry={retryAll} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
          <StatCard label={t.marketingCampaigns} value={campaigns.length} loading={loading} />
          <StatCard label={t.marketingTemplates} value={templates.length} loading={loading} />
          <StatCard label={t.marketingActiveReminders} value={activeReminders} loading={loading} />
        </div>
      )}

      {/* Quick actions */}
      <div style={{ marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_NEW)}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--color-primary-600)',
            color: 'white',
            fontWeight: 700,
            fontSize: '15px',
            cursor: 'pointer',
            marginBottom: '10px',
          }}
        >
          {t.marketingNewCampaign}
        </button>
      </div>

      {/* Nav tiles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <NavTile
          icon={<Send size={20} color="var(--color-primary-600)" aria-hidden="true" />}
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
          icon={<ShieldOff size={20} color="var(--color-error-600, #dc2626)" aria-hidden="true" />}
          title={t.marketingOptOuts}
          description={t.marketingOptOutsDesc}
          route={MARKETING_ROUTES.OPT_OUTS}
          color="var(--color-error-50, #fef2f2)"
          cta={t.marketingView}
        />
      </div>
    </div>
  )
}
