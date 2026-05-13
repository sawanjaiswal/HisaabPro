/** TemplatePreview — substituted template body preview card */

import { substituteVars } from '../marketing.utils'
import type { MarketingTemplate } from '../marketing.types'

interface Props {
  template: MarketingTemplate
  vars?: Record<string, string>
}

const SAMPLE_VARS: Record<string, string> = {
  customerName: 'Raju Sharma',
  amount:       'Rs 5,000',
  dueDate:      '20 May 2026',
  businessName: 'Priya Traders',
  shopName:     'Priya Traders',
}

export function TemplatePreview({ template, vars }: Props) {
  const substituted = substituteVars(template.bodyEn, { ...SAMPLE_VARS, ...vars })

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: 'var(--color-gray-50)',
        border: '1px solid var(--color-gray-200)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-gray-500)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '8px',
        }}
      >
        Message Preview
      </div>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '8px',
          background: template.channel === 'WHATSAPP' ? '#dcf8c6' : 'white',
          border: '1px solid var(--color-gray-200)',
          fontSize: '14px',
          lineHeight: '1.6',
          color: 'var(--color-gray-800)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {substituted}
      </div>
      {template.variables.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-gray-500)' }}>
          Variables: {template.variables.map((v) => `{{${v}}}`).join(', ')}
        </div>
      )}
    </div>
  )
}
