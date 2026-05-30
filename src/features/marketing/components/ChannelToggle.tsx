/** ChannelToggle — icon toggle between WhatsApp and SMS channels */

import { useLanguage } from '@/hooks/useLanguage'
import type { MarketingChannel } from '../marketing.types'
import { CHANNEL_LABEL, CHANNEL_COLOR } from '../marketing.constants'
import { Button } from '@/components/ui/Button'

interface Props {
  value: MarketingChannel
  onChange: (channel: MarketingChannel) => void
  disabled?: boolean
}

const CHANNELS: MarketingChannel[] = ['WHATSAPP', 'SMS']

export function ChannelToggle({ value, onChange, disabled = false }: Props) {
  const { t } = useLanguage()
  return (
    <div className="channel-toggle" role="group" aria-label={t.marketingSelectChannel}>
      {CHANNELS.map((ch) => {
        const active = value === ch
        const color = CHANNEL_COLOR[ch]
        return (
          <Button variant="none"
            key={ch}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(ch)}
            disabled={disabled}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 20px',
              borderRadius: '10px',
              border: `2px solid ${active ? color : 'var(--color-gray-200)'}`,
              background: active ? `color-mix(in srgb, ${color} 10%, transparent)` : 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              fontWeight: active ? 700 : 400,
              color: active ? color : 'var(--color-gray-600)',
              fontSize: '14px',
              transition: 'all 0.15s ease',
              flex: 1,
              minWidth: 0,
            }}
          >
            {ch === 'WHATSAPP' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill={active ? color : 'var(--color-gray-400)'} aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.525 5.847L0 24l6.313-1.497A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.905 0-3.693-.5-5.24-1.375L2.5 21.75l1.154-4.197A9.95 9.95 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill={active ? color : 'var(--color-gray-400)'} aria-hidden="true">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
              </svg>
            )}
            {CHANNEL_LABEL[ch]}
          </Button>
        )
      })}
    </div>
  )
}
