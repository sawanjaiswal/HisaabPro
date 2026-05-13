/** CampaignWizardStep2 — Template picker */

import { useMarketingTemplateList } from '../hooks/useMarketingTemplates'
import { ChannelBadge } from './ChannelBadge'
import type { MarketingChannel } from '../marketing.types'

interface Props {
  channel: MarketingChannel
  value: string
  onChange: (templateId: string) => void
}

export function CampaignWizardStep2Template({ channel, value, onChange }: Props) {
  const { templates, status } = useMarketingTemplateList(channel)

  if (status === 'loading') {
    return (
      <div aria-busy="true" aria-label="Loading templates">
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 64, borderRadius: 10, background: 'var(--color-gray-100)', marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '16px', color: 'var(--color-error-600)', fontSize: '14px' }}>
        Could not load templates. Pull to retry.
      </div>
    )
  }

  const active = templates.filter((t) => t.isActive)

  if (active.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-gray-500)', fontSize: '14px' }}>
        <p>No active {channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'} templates.</p>
        <p style={{ marginTop: '8px', fontSize: '13px' }}>Create a template first from the Templates section.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {active.map((t) => {
        const selected = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `2px solid ${selected ? 'var(--color-primary-500)' : 'var(--color-gray-200)'}`,
              background: selected ? 'var(--color-primary-50)' : 'white',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-gray-800)', flex: 1 }}>
                {t.name}
              </span>
              <ChannelBadge channel={t.channel} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-gray-500)', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {t.bodyEn}
            </div>
            {t.variables.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--color-gray-400)' }}>
                Variables: {t.variables.map((v) => `{{${v}}}`).join(', ')}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
