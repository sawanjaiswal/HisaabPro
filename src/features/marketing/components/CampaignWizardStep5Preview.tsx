/** CampaignWizardStep5 — Preview and launch */

import { useLanguage } from '@/hooks/useLanguage'
import { TemplatePreview } from './TemplatePreview'
import { ChannelBadge } from './ChannelBadge'
import { QuietHoursNotice } from './QuietHoursNotice'
import { useMarketingTemplateDetail } from '../hooks/useMarketingTemplates'
import { useSegmentPreview } from '../hooks/useSegmentPreview'
import { formatScheduledAt, formatCostEstimate } from '../marketing.utils'
import type { CampaignWizardState } from '../marketing.types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Props {
  state: CampaignWizardState
  onLaunch: () => void
  launching: boolean
}

export function CampaignWizardStep5Preview({ state, onLaunch, launching }: Props) {
  const { t } = useLanguage()
  const { template } = useMarketingTemplateDetail(state.templateId)
  const { preview, loading: countLoading, tooLarge } = useSegmentPreview(state.segmentFilter)

  const count = preview?.count ?? 0
  const canLaunch = !tooLarge && count > 0 && !launching

  const audienceText = countLoading
    ? t.marketingCountingShort
    : tooLarge
      ? t.marketingTooLargeShort
      : `~${count.toLocaleString('en-IN')} ${t.marketingApproxCustomers}`

  return (
    <div className="flex flex-col gap-5">
      {/* Summary card */}
      <Card className="p-4 rounded-xl bg-[var(--color-gray-50)] border border-border">
        <div className="flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-muted)] shrink-0">{t.marketingCampaignRow}</span>
            <span className="font-semibold text-[var(--text-primary)]">{state.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-muted)] shrink-0">{t.marketingChannelRow}</span>
            <ChannelBadge channel={state.channel} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-muted)] shrink-0">{t.marketingTemplateRow}</span>
            <span className="text-[var(--text-secondary)]">{template?.name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-muted)] shrink-0">{t.marketingAudienceRow}</span>
            <span className={`font-semibold ${tooLarge ? 'text-destructive' : 'text-[var(--text-primary)]'}`}>
              {audienceText}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-muted)] shrink-0">{t.marketingScheduleRow}</span>
            <span className="text-[var(--text-secondary)]">{formatScheduledAt(state.scheduledAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-muted)] shrink-0">{t.marketingEstCostRow}</span>
            <span className="text-[var(--text-secondary)]">
              {count > 0 && !tooLarge ? formatCostEstimate(state.channel, count) : '—'}
            </span>
          </div>
        </div>
      </Card>

      {/* Template preview */}
      {template && <TemplatePreview template={template} />}

      {/* Quiet hours notice */}
      <QuietHoursNotice />

      {/* Errors */}
      {tooLarge && (
        <div role="alert" className="p-3 rounded-lg bg-[var(--color-error-50)] border border-[var(--color-error-200)] text-destructive text-xs">
          {t.marketingAudienceTooLargeBack}
        </div>
      )}
      {!countLoading && count === 0 && !tooLarge && (
        <div role="alert" className="p-3 rounded-lg bg-[var(--color-warning-50)] border border-[var(--color-warning-200)] text-amber-700 text-xs">
          {t.marketingAudienceNoMatchBack}
        </div>
      )}

      {/* Launch CTA */}
      <Button
        variant="primary"
        size="lg"
        className="w-full mt-1"
        onClick={onLaunch}
        disabled={!canLaunch}
        aria-disabled={!canLaunch}
      >
        {launching ? t.marketingLaunching : t.marketingLaunchCampaign}
      </Button>
    </div>
  )
}
