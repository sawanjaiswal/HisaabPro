/** CampaignListPage — /marketing/campaigns — list with status filter */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, RefreshCw, Send } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'
import { useCampaignList } from '../hooks/useCampaigns'
import { CampaignStatusBadge } from '../components/CampaignStatusBadge'
import { ChannelBadge } from '../components/ChannelBadge'
import { MARKETING_ROUTES } from '../marketing.constants'
import { formatDate, formatPaiseAsRupees } from '../marketing.utils'
import type { CampaignStatus } from '../marketing.types'
import { Button } from '@/components/ui/Button'

type FilterValue = CampaignStatus | ''

type FilterKey = 'marketingAllFilter' | 'marketingStatusDraft' | 'marketingStatusScheduled' | 'marketingStatusRunning' | 'marketingStatusCompleted'

const FILTERS: Array<{ value: FilterValue; key: FilterKey }> = [
  { value: '',          key: 'marketingAllFilter' },
  { value: 'DRAFT',     key: 'marketingStatusDraft' },
  { value: 'SCHEDULED', key: 'marketingStatusScheduled' },
  { value: 'RUNNING',   key: 'marketingStatusRunning' },
  { value: 'COMPLETED', key: 'marketingStatusCompleted' },
]

function CampaignSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div aria-busy="true" aria-label={ariaLabel}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--color-gray-100)', marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )
}

export default function CampaignListPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [statusFilter, setStatusFilter] = useState<FilterValue>('')
  const { campaigns, status, refresh } = useCampaignList(statusFilter)

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: 'var(--bottom-nav-height, 112px)', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Button variant="ghost" type="button" className="btn-icon" onClick={() => navigate(MARKETING_ROUTES.HUB)} aria-label={t.marketingBackToMarketingAria}>
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <h1 style={{ flex: 1, fontSize: '20px', fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>{t.marketingCampaignsTitle}</h1>
        <Button variant="none"
          type="button"
          onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_NEW)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', minHeight: '44px' }}
          aria-label={t.marketingNewAria}
        >
          <Plus size={16} aria-hidden="true" /> {t.marketingNew}
        </Button>
      </div>

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px' }}>
        {FILTERS.map(({ value: f, key }) => (
          <Button variant="none"
            key={f || 'all'}
            type="button"
            onClick={() => setStatusFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              border: `1px solid ${statusFilter === f ? 'var(--color-primary-600)' : 'var(--color-gray-300)'}`,
              background: statusFilter === f ? 'var(--color-primary-600)' : 'white',
              color: statusFilter === f ? 'white' : 'var(--color-gray-600)',
              fontWeight: statusFilter === f ? 700 : 400,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            aria-pressed={statusFilter === f}
          >
            {t[key]}
          </Button>
        ))}
      </div>

      {/* Loading */}
      {status === 'loading' && <CampaignSkeleton ariaLabel={t.marketingLoadingCampaignsAria} />}

      {/* Error */}
      {status === 'error' && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-error-600)', fontSize: '14px' }}>
          <div>{t.marketingCampaignsLoadFailed}</div>
          <Button variant="none" type="button" onClick={refresh} style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-error-300)', background: 'white', color: 'var(--color-error-600)', cursor: 'pointer', fontSize: '14px', minHeight: '44px' }}>
            <RefreshCw size={14} aria-hidden="true" /> {t.marketingRetry}
          </Button>
        </div>
      )}

      {/* Empty */}
      {status === 'success' && campaigns.length === 0 && (
        <EmptyState
          icon={<Send size={22} aria-hidden="true" />}
          title={t.marketingNoCampaignsYet}
          description={t.marketingNoCampaignsDesc}
          action={
            <Button variant="none" type="button" onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_NEW)} style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--color-primary-600)', color: 'white', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', minHeight: '44px' }}>
              {t.marketingCreateFirstCampaign}
            </Button>
          }
        />
      )}

      {/* List */}
      {status === 'success' && campaigns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {campaigns.map((c) => (
            <Button variant="none"
              key={c.id}
              type="button"
              onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_DETAIL.replace(':id', c.id))}
              style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', borderRadius: '12px', background: 'white', border: '1px solid var(--color-gray-200)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ flex: 1, fontWeight: 600, fontSize: '15px', color: 'var(--color-gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <ChannelBadge channel={c.channel} />
                <CampaignStatusBadge status={c.status} />
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-gray-500)' }}>
                <span>{t.marketingSent}: {c.sentCount.toLocaleString('en-IN')}</span>
                {c.failedCount > 0 && <span style={{ color: 'var(--color-error-600)' }}>{t.marketingFailedLabel}: {c.failedCount.toLocaleString('en-IN')}</span>}
                {c.totalCostPaise > 0 && <span>{t.marketingCost}: {formatPaiseAsRupees(c.totalCostPaise)}</span>}
                <span style={{ marginLeft: 'auto' }}>{formatDate(c.createdAt)}</span>
              </div>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
