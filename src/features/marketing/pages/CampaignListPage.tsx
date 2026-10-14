/** CampaignListPage — /marketing/campaigns — list with status filter */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Send } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { useCampaignList } from '../hooks/useCampaigns'
import { CampaignStatusBadge } from '../components/CampaignStatusBadge'
import { ChannelBadge } from '../components/ChannelBadge'
import { MARKETING_ROUTES } from '../marketing.constants'
import { formatDate, formatPaiseAsRupees } from '../marketing.utils'
import type { CampaignStatus } from '../marketing.types'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'

type FilterValue = CampaignStatus | ''

type FilterKey = 'marketingAllFilter' | 'marketingStatusDraft' | 'marketingStatusScheduled' | 'marketingStatusRunning' | 'marketingStatusCompleted'

const FILTERS: Array<{ value: FilterValue; key: FilterKey }> = [
  { value: '',          key: 'marketingAllFilter' },
  { value: 'DRAFT',     key: 'marketingStatusDraft' },
  { value: 'SCHEDULED', key: 'marketingStatusScheduled' },
  { value: 'RUNNING',   key: 'marketingStatusRunning' },
  { value: 'COMPLETED', key: 'marketingStatusCompleted' },
]

export default function CampaignListPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [statusFilter, setStatusFilter] = useState<FilterValue>('')
  const { campaigns, status, refresh } = useCampaignList(statusFilter)

  return (
    <AppShell
      header={
        <Header
          title={t.marketingCampaignsTitle}
          backTo={MARKETING_ROUTES.HUB}
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_NEW)}
              aria-label={t.marketingNewAria}
              className="gap-1.5"
            >
              <Plus size={16} aria-hidden="true" />
              <span>{t.marketingNew}</span>
            </Button>
          }
        />
      }
    >
      <PageContainer className="py-4 pb-24 max-w-2xl mx-auto space-y-4">
        {/* Status filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTERS.map(({ value: f, key }) => (
            <Button
              key={f || 'all'}
              variant={statusFilter === f ? 'primary' : 'outline'}
              size="sm"
              className="rounded-full text-xs font-medium shrink-0 whitespace-nowrap"
              onClick={() => setStatusFilter(f)}
              aria-pressed={statusFilter === f}
            >
              {t[key]}
            </Button>
          ))}
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div aria-busy="true" aria-label={t.marketingLoadingCampaignsAria} className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.marketingCampaignsLoadFailed}
            onRetry={refresh}
            retryLabel={t.marketingRetry}
          />
        )}

        {/* Empty */}
        {status === 'success' && campaigns.length === 0 && (
          <EmptyState
            icon={<Send size={22} aria-hidden="true" />}
            title={t.marketingNoCampaignsYet}
            description={t.marketingNoCampaignsDesc}
            action={
              <Button
                variant="primary"
                onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_NEW)}
              >
                {t.marketingCreateFirstCampaign}
              </Button>
            }
          />
        )}

        {/* List */}
        {status === 'success' && campaigns.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {campaigns.map((c) => (
              <Card
                key={c.id}
                clickable
                hover
                onClick={() => navigate(MARKETING_ROUTES.CAMPAIGN_DETAIL.replace(':id', c.id))}
                className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-border bg-card shadow-2xs text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-semibold text-sm text-[var(--text-primary)] truncate">{c.name}</span>
                  <ChannelBadge channel={c.channel} />
                  <CampaignStatusBadge status={c.status} />
                </div>
                <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                  <span>{t.marketingSent}: {formatNumber(c.sentCount)}</span>
                  {c.failedCount > 0 && <span className="text-destructive">{t.marketingFailedLabel}: {formatNumber(c.failedCount)}</span>}
                  {c.totalCostPaise > 0 && <span>{t.marketingCost}: {formatPaiseAsRupees(c.totalCostPaise)}</span>}
                  <span className="ml-auto">{formatDate(c.createdAt)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </AppShell>
  )
}
