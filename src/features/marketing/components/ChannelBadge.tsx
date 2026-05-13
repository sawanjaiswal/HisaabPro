/** ChannelBadge — WhatsApp / SMS channel indicator */

import type { MarketingChannel } from '../marketing.types'
import { CHANNEL_LABEL, CHANNEL_COLOR } from '../marketing.constants'

interface Props {
  channel: MarketingChannel
  size?: 'sm' | 'md'
}

export function ChannelBadge({ channel, size = 'sm' }: Props) {
  const color = CHANNEL_COLOR[channel]
  const label = CHANNEL_LABEL[channel]

  return (
    <span
      className={`channel-badge channel-badge--${size}`}
      style={{
        '--channel-color': color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: '999px',
        fontSize: size === 'sm' ? '11px' : '13px',
        fontWeight: 600,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      } as React.CSSProperties}
      aria-label={`Channel: ${label}`}
    >
      {channel === 'WHATSAPP' ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.525 5.847L0 24l6.313-1.497A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.905 0-3.693-.5-5.24-1.375L2.5 21.75l1.154-4.197A9.95 9.95 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
        </svg>
      )}
      {label}
    </span>
  )
}
