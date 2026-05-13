/** CampaignWizardStep5 — Preview and launch */

import { TemplatePreview } from './TemplatePreview'
import { ChannelBadge } from './ChannelBadge'
import { QuietHoursNotice } from './QuietHoursNotice'
import { useMarketingTemplateDetail } from '../hooks/useMarketingTemplates'
import { useSegmentPreview } from '../hooks/useSegmentPreview'
import { formatScheduledAt, formatCostEstimate } from '../marketing.utils'
import type { CampaignWizardState } from '../marketing.types'

interface Props {
  state: CampaignWizardState
  onLaunch: () => void
  launching: boolean
}

export function CampaignWizardStep5Preview({ state, onLaunch, launching }: Props) {
  const { template } = useMarketingTemplateDetail(state.templateId)
  const { preview, loading: countLoading, tooLarge } = useSegmentPreview(state.segmentFilter)

  const count = preview?.count ?? 0
  const canLaunch = !tooLarge && count > 0 && !launching

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Summary card */}
      <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
          <div style={rowStyle}>
            <span style={keyStyle}>Campaign</span>
            <span style={{ fontWeight: 600, color: 'var(--color-gray-800)' }}>{state.name}</span>
          </div>
          <div style={rowStyle}>
            <span style={keyStyle}>Channel</span>
            <ChannelBadge channel={state.channel} />
          </div>
          <div style={rowStyle}>
            <span style={keyStyle}>Template</span>
            <span style={{ color: 'var(--color-gray-700)' }}>{template?.name ?? '—'}</span>
          </div>
          <div style={rowStyle}>
            <span style={keyStyle}>Audience</span>
            <span style={{ fontWeight: 600, color: tooLarge ? 'var(--color-error-600)' : 'var(--color-gray-800)' }}>
              {countLoading ? 'Counting...' : tooLarge ? '10,000+ (too large)' : `~${count.toLocaleString('en-IN')} customers`}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={keyStyle}>Schedule</span>
            <span style={{ color: 'var(--color-gray-700)' }}>{formatScheduledAt(state.scheduledAt)}</span>
          </div>
          <div style={rowStyle}>
            <span style={keyStyle}>Est. cost</span>
            <span style={{ color: 'var(--color-gray-700)' }}>
              {count > 0 && !tooLarge ? formatCostEstimate(state.channel, count) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Template preview */}
      {template && <TemplatePreview template={template} />}

      {/* Quiet hours notice */}
      <QuietHoursNotice />

      {/* Errors */}
      {tooLarge && (
        <div role="alert" style={alertStyle('error')}>
          Audience too large. Go back and add more filters.
        </div>
      )}
      {!countLoading && count === 0 && !tooLarge && (
        <div role="alert" style={alertStyle('warning')}>
          No customers match these filters. Go back to adjust your audience.
        </div>
      )}

      {/* Launch CTA */}
      <button
        type="button"
        onClick={onLaunch}
        disabled={!canLaunch}
        style={{
          display: 'block',
          width: '100%',
          padding: '16px',
          borderRadius: '12px',
          border: 'none',
          background: canLaunch ? 'var(--color-primary-600)' : 'var(--color-gray-300)',
          color: 'white',
          fontSize: '16px',
          fontWeight: 700,
          cursor: canLaunch ? 'pointer' : 'not-allowed',
          letterSpacing: '0.3px',
          marginTop: '4px',
        }}
        aria-disabled={!canLaunch}
      >
        {launching ? 'Launching...' : 'Launch Campaign'}
      </button>
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
}

const keyStyle: React.CSSProperties = {
  color: 'var(--color-gray-500)',
  flexShrink: 0,
}

function alertStyle(type: 'error' | 'warning'): React.CSSProperties {
  const colors = type === 'error'
    ? { bg: 'var(--color-error-50)', border: 'var(--color-error-200)', color: 'var(--color-error-700)' }
    : { bg: 'var(--color-warning-50)', border: 'var(--color-warning-200)', color: 'var(--color-warning-700)' }
  return {
    padding: '12px 14px',
    borderRadius: '8px',
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.color,
    fontSize: '13px',
  }
}
