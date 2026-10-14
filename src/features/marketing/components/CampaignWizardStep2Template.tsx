/** CampaignWizardStep2 — Template picker */

import { Text } from '@/components/ui/Text'
import { useLanguage } from '@/hooks/useLanguage'
import { useMarketingTemplateList } from '../hooks/useMarketingTemplates'
import { ChannelBadge } from './ChannelBadge'
import type { MarketingChannel } from '../marketing.types'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

interface Props {
  channel: MarketingChannel
  value: string
  onChange: (templateId: string) => void
}

export function CampaignWizardStep2Template({ channel, value, onChange }: Props) {
  const { t } = useLanguage()
  const { templates, status } = useMarketingTemplateList(channel)

  if (status === 'loading') {
    return (
      <div aria-busy="true" aria-label={t.marketingLoadingTemplatesAria} className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="p-4 text-destructive text-sm text-center">
        {t.marketingTemplatesLoadFailed}
      </div>
    )
  }

  const active = templates.filter((tmpl) => tmpl.isActive)

  if (active.length === 0) {
    return (
      <div className="py-8 px-4 text-center text-[var(--text-muted)] text-sm space-y-2">
        <Text>{channel === 'WHATSAPP' ? t.marketingNoActiveWaTemplates : t.marketingNoActiveSmsTemplates}</Text>
        <Text className="text-xs text-[var(--text-muted)]">{t.marketingCreateTemplateFirst}</Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {active.map((tmpl) => {
        const selected = value === tmpl.id
        return (
          <Card
            key={tmpl.id}
            clickable
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(tmpl.id)}
            className={cn(
              'flex flex-col gap-1 p-3.5 rounded-xl border text-left transition-all',
              selected
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:border-[var(--border-strong)]'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[var(--text-primary)] flex-1">
                {tmpl.name}
              </span>
              <ChannelBadge channel={tmpl.channel} />
            </div>
            <div className="text-xs text-[var(--text-muted)] line-clamp-2">
              {tmpl.bodyEn}
            </div>
            {tmpl.variables.length > 0 && (
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                {t.marketingVariablesLabel}: {tmpl.variables.map((v) => `{{${v}}}`).join(', ')}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
