/** CampaignWizardStep2 — Template picker */

import { useLanguage } from '@/hooks/useLanguage'
import { useMarketingTemplateList } from '../hooks/useMarketingTemplates'
import { ChannelBadge } from './ChannelBadge'
import type { MarketingChannel } from '../marketing.types'
import { Button } from '@/components/ui/Button'

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
      <div aria-busy="true" aria-label={t.marketingLoadingTemplatesAria}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 64, borderRadius: 10, background: 'var(--color-gray-100)', marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '16px', color: 'var(--color-error-600)', fontSize: '14px' }}>
        {t.marketingTemplatesLoadFailed}
      </div>
    )
  }

  const active = templates.filter((tmpl) => tmpl.isActive)

  if (active.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-gray-500)', fontSize: '14px' }}>
        <p>{channel === 'WHATSAPP' ? t.marketingNoActiveWaTemplates : t.marketingNoActiveSmsTemplates}</p>
        <p style={{ marginTop: '8px', fontSize: '13px' }}>{t.marketingCreateTemplateFirst}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {active.map((tmpl) => {
        const selected = value === tmpl.id
        return (
          <Button variant="none"
            key={tmpl.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(tmpl.id)}
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
                {tmpl.name}
              </span>
              <ChannelBadge channel={tmpl.channel} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--color-gray-500)', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {tmpl.bodyEn}
            </div>
            {tmpl.variables.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--color-gray-400)' }}>
                {t.marketingVariablesLabel}: {tmpl.variables.map((v) => `{{${v}}}`).join(', ')}
              </div>
            )}
          </Button>
        )
      })}
    </div>
  )
}
