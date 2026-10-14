/** CampaignWizardStep1 — Name and Channel */

import { useLanguage } from '@/hooks/useLanguage'
import { ChannelToggle } from './ChannelToggle'
import type { MarketingChannel } from '../marketing.types'
import { Input } from '@/components/ui/Input'

interface Props {
  name: string
  channel: MarketingChannel
  onNameChange: (name: string) => void
  onChannelChange: (ch: MarketingChannel) => void
}

export function CampaignWizardStep1Channel({ name, channel, onNameChange, onChannelChange }: Props) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor="campaign-name" className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
          {t.marketingCampaignName} *
        </label>
        <Input
          id="campaign-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t.marketingCampaignNamePh}
          maxLength={100}
          autoFocus
          aria-required="true"
        />
        <div className="mt-1 text-xs text-[var(--text-muted)] text-right">
          {name.length}/100
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
          {t.marketingSendVia}
        </label>
        <div className="flex gap-3">
          <ChannelToggle value={channel} onChange={onChannelChange} />
        </div>
      </div>
    </div>
  )
}
