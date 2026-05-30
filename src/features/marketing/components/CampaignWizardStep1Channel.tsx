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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label htmlFor="campaign-name" style={labelStyle}>{t.marketingCampaignName} *</label>
        <Input
          id="campaign-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t.marketingCampaignNamePh}
          maxLength={100}
          autoFocus
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '10px',
            border: '1px solid var(--color-gray-300)',
            fontSize: '16px',
            color: 'var(--color-gray-800)',
            background: 'white',
            boxSizing: 'border-box',
          }}
          aria-required="true"
        />
        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-gray-400)', textAlign: 'right' }}>
          {name.length}/100
        </div>
      </div>

      <div>
        <p style={labelStyle}>{t.marketingSendVia}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <ChannelToggle value={channel} onChange={onChannelChange} />
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--color-gray-700)',
  marginBottom: '8px',
}
