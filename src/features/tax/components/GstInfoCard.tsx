/** Tax — GST Info Card (sub-component)
 *
 * Shows GSTIN, state, composition scheme toggle.
 * Editing inline — tap to toggle composition scheme.
 */

import { useState } from 'react'
import { Building2, CheckCircle, XCircle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { GstSettings } from '../useGstSettings'

interface GstInfoCardProps {
  gstin: string | null
  stateCode: string | null
  stateName: string | null
  compositionScheme: boolean
  onUpdate: (data: Partial<GstSettings>) => Promise<void>
}

export function GstInfoCard({ gstin, stateCode, stateName, compositionScheme, onUpdate }: GstInfoCardProps) {
  const { t } = useLanguage()
  const [saving, setSaving] = useState(false)

  async function handleToggleComposition() {
    setSaving(true)
    await onUpdate({ compositionScheme: !compositionScheme })
    setSaving(false)
  }

  return (
    <div className="gst-info-card">
      <div className="gst-info-header">
        <span className="gst-info-icon" aria-hidden="true"><Building2 size={24} /></span>
        <span className="gst-info-title">{t.businessGstProfile}</span>
      </div>

      <div className="gst-info-row">
        <span className="gst-info-label">{t.gstin}</span>
        <span className="gst-info-value">
          {gstin ? (
            <><CheckCircle size={14} className="gst-info-check" aria-hidden="true" /> {gstin}</>
          ) : (
            <><XCircle size={14} className="gst-info-missing" aria-hidden="true" /> {t.notSet}</>
          )}
        </span>
      </div>

      <div className="gst-info-row">
        <span className="gst-info-label">{t.state}</span>
        <span className="gst-info-value">{stateCode ? `${stateCode} — ${stateName}` : t.notSet}</span>
      </div>

      <div className="gst-info-row">
        <span className="gst-info-label">{t.compositionScheme}</span>
        <button
          className={`gst-toggle ${compositionScheme ? 'gst-toggle-on' : ''}`}
          onClick={handleToggleComposition}
          disabled={saving}
          aria-label={compositionScheme ? t.compositionSchemeEnabled : t.compositionSchemeDisabled}
          role="switch"
          aria-checked={compositionScheme}
        >
          <span className="gst-toggle-thumb" />
        </button>
      </div>
    </div>
  )
}
