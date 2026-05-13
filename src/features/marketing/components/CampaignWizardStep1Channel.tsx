/** CampaignWizardStep1 — Name and Channel */

import { ChannelToggle } from './ChannelToggle'
import type { MarketingChannel } from '../marketing.types'

interface Props {
  name: string
  channel: MarketingChannel
  onNameChange: (name: string) => void
  onChannelChange: (ch: MarketingChannel) => void
}

export function CampaignWizardStep1Channel({ name, channel, onNameChange, onChannelChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label htmlFor="campaign-name" style={labelStyle}>Campaign Name *</label>
        <input
          id="campaign-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Diwali Offer 2026"
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
        <p style={labelStyle}>Send via</p>
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
