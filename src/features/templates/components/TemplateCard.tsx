/** Template gallery card — shows preview thumbnail, name, and default badges */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { TemplateSummary } from '../template.types'
import { BASE_TEMPLATE_LABELS, DOCUMENT_TYPE_TITLE_LABELS } from '../template.constants'

interface TemplateCardProps {
  template: TemplateSummary
  onClick: (id: string) => void
}

/** Short abbreviation shown in the preview placeholder, e.g. "A4C", "T58" */
function getBaseTemplateAbbrev(baseTemplate: TemplateSummary['baseTemplate']): string {
  switch (baseTemplate) {
    case 'THERMAL_58MM': return 'T58'
    case 'THERMAL_80MM': return 'T80'
    case 'A4_CLASSIC':   return 'A4C'
    case 'A4_MODERN':    return 'A4M'
    case 'A5_COMPACT':   return 'A5'
    case 'A4_DETAILED':  return 'A4D'
    default:             return 'TPL'
  }
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ template, onClick }) => {
  const { t } = useLanguage()
  const abbrev = getBaseTemplateAbbrev(template.baseTemplate)
  const baseLabel = BASE_TEMPLATE_LABELS[template.baseTemplate]

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(template.id)
    }
  }

  return (
    <div
      className="template-card"
      role="button"
      tabIndex={0}
      aria-label={`Template: ${template.name}, base ${baseLabel}${template.isDefault ? ', default' : ''}`}
      onClick={() => onClick(template.id)}
      onKeyDown={handleKeyDown}
      style={{ minHeight: '44px' }}
    >
      <div className="template-card-preview" aria-hidden="true">
        <span
          style={{
            fontSize: 'var(--fs-lg)',
            fontWeight: 700,
            color: 'var(--color-primary-300)',
            letterSpacing: '0.04em',
          }}
        >
          {abbrev}
        </span>

        {template.isDefault && (
          <span className="template-card-default-badge" aria-label={t.defaultBadge}>
            {t.defaultBadge}
          </span>
        )}
      </div>

      <div className="template-card-info">
        <div className="template-card-name" title={template.name}>
          {template.name}
        </div>

        {template.defaultForTypes.length > 0 && (
          <div className="template-card-badges" aria-label={t.defaultForDocTypes}>
            {template.defaultForTypes.map((docType) => (
              <span key={docType} className="template-card-badge">
                {DOCUMENT_TYPE_TITLE_LABELS[docType]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
