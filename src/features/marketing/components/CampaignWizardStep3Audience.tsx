/** CampaignWizardStep3 — Audience / Segment builder */

import { useLanguage } from '@/hooks/useLanguage'
import { AudiencePicker } from './AudiencePicker'
import { useSegmentPreview } from '../hooks/useSegmentPreview'
import type { SegmentFilter } from '../marketing.types'

interface Props {
  value: SegmentFilter
  onChange: (filter: SegmentFilter) => void
}

export function CampaignWizardStep3Audience({ value, onChange }: Props) {
  const { t } = useLanguage()
  const { preview, tooLarge } = useSegmentPreview(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <AudiencePicker value={value} onChange={onChange} />

      {tooLarge && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'var(--color-error-50)',
            border: '1px solid var(--color-error-200)',
            color: 'var(--color-error-700)',
            fontSize: '13px',
          }}
        >
          {t.marketingAudienceTooLarge}
        </div>
      )}

      {!tooLarge && preview != null && preview.count === 0 && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'var(--color-warning-50)',
            border: '1px solid var(--color-warning-200)',
            color: 'var(--color-warning-700)',
            fontSize: '13px',
          }}
        >
          {t.marketingAudienceNoMatch}
        </div>
      )}

      {!tooLarge && preview != null && preview.sample.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-gray-500)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t.marketingSampleRecipients}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {preview.sample.slice(0, 5).map((p) => (
              <div key={p.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', background: 'var(--color-gray-50)', fontSize: '13px' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-gray-800)', flex: 1 }}>{p.name}</span>
                <span style={{ color: 'var(--color-gray-400)' }}>{p.phone ?? t.marketingNoPhone}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
