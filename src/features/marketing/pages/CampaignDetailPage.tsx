/** CampaignDetailPage — /marketing/campaigns/:id — detail + cancel */

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { useCampaignDetail, useCancelCampaign } from '../hooks/useCampaigns'
import { CampaignStatusBadge } from '../components/CampaignStatusBadge'
import { ChannelBadge } from '../components/ChannelBadge'
import { RecipientTable } from '../components/RecipientTable'
import { MARKETING_ROUTES } from '../marketing.constants'
import { formatDate, formatPaiseAsRupees, formatScheduledAt } from '../marketing.utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card className="flex-1 min-w-[80px] p-3.5 rounded-xl border border-border bg-card text-center shadow-2xs">
      <div className="text-xl font-bold text-[var(--text-primary)]" style={color ? { color } : undefined}>{value}</div>
      <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-primary)] font-medium">{value}</span>
    </div>
  )
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLanguage()
  const { campaign, status, refresh } = useCampaignDetail(id ?? '')
  const cancelMutation = useCancelCampaign()
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (!id) return null

  if (status === 'loading') {
    return (
      <AppShell header={<Header title={t.marketingCampaignsTitle} backTo={MARKETING_ROUTES.CAMPAIGNS} />}>
        <PageContainer className="py-4 pb-24 max-w-2xl mx-auto space-y-4" aria-busy="true" aria-label={t.marketingLoadingCampaignAria}>
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </PageContainer>
      </AppShell>
    )
  }

  if (status === 'error' || !campaign) {
    return (
      <AppShell header={<Header title={t.marketingCampaignsTitle} backTo={MARKETING_ROUTES.CAMPAIGNS} />}>
        <PageContainer className="py-8 text-center max-w-2xl mx-auto space-y-3">
          <ErrorState
            title={t.marketingCampaignLoadFailed}
            onRetry={refresh}
            retryLabel={t.marketingRetry}
          />
        </PageContainer>
      </AppShell>
    )
  }

  const canCancel = campaign.status === 'SCHEDULED' || campaign.status === 'RUNNING'

  return (
    <AppShell
      header={
        <Header
          title={campaign.name}
          backTo={MARKETING_ROUTES.CAMPAIGNS}
        />
      }
    >
      <PageContainer className="py-4 pb-24 max-w-2xl mx-auto">
        <div className="flex gap-2 mb-4 flex-wrap">
          <ChannelBadge channel={campaign.channel} />
          <CampaignStatusBadge status={campaign.status} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          <Stat label={t.marketingRecipients} value={campaign.recipientCount.toLocaleString('en-IN')} />
          <Stat label={t.marketingSent} value={campaign.sentCount.toLocaleString('en-IN')} color="var(--color-success-600)" />
          <Stat label={t.marketingDelivered} value={campaign.deliveredCount.toLocaleString('en-IN')} />
          <Stat label={t.marketingFailedLabel} value={campaign.failedCount.toLocaleString('en-IN')} color={campaign.failedCount > 0 ? 'var(--color-error-600)' : undefined} />
        </div>

        {/* Meta */}
        <Card className="p-3.5 rounded-xl bg-[var(--color-gray-50)] border border-border mb-5">
          <div className="flex flex-col gap-2 text-xs">
            <Row label={t.marketingScheduleRow} value={formatScheduledAt(campaign.scheduledAt)} />
            <Row label={t.marketingCost} value={campaign.totalCostPaise > 0 ? formatPaiseAsRupees(campaign.totalCostPaise) : '—'} />
            <Row label={t.marketingCreated} value={formatDate(campaign.createdAt)} />
          </div>
        </Card>

        {/* Recipients */}
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2.5">{t.marketingRecipients}</h2>
          <RecipientTable campaignId={campaign.id} />
        </div>

        {/* Cancel */}
        {canCancel && (
          <Button
            variant="destructive"
            className="w-full mt-4"
            onClick={() => setConfirmCancel(true)}
          >
            {t.marketingCancelCampaign}
          </Button>
        )}

        {/* Confirm cancel dialog */}
        <ConfirmDialog
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => {
            setConfirmCancel(false)
            cancelMutation.mutate({ id: campaign.id, name: campaign.name })
          }}
          title={t.marketingCancelCampaignTitle}
          description={t.marketingCancelCampaignDesc}
          confirmLabel={cancelMutation.isPending ? t.marketingCancellingShort : t.marketingYesCancel}
          cancelLabel={t.marketingKeepRunning}
          isDanger={true}
          isLoading={cancelMutation.isPending}
        />
      </PageContainer>
    </AppShell>
  )
}
