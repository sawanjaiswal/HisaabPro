/** Base template card — shown in the "BASE TEMPLATES" section with a "Use This" CTA */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { BaseTemplate } from '../template.types'
import { BASE_TEMPLATE_LABELS, BASE_TEMPLATE_DESCRIPTIONS } from '../template.constants'

interface BaseTemplateCardProps {
  baseTemplate: BaseTemplate
  onSelect: (base: BaseTemplate) => void
}

/** Short abbreviation for the preview placeholder */
function getAbbrev(base: BaseTemplate): string {
  switch (base) {
    case 'THERMAL_58MM': return 'T58'
    case 'THERMAL_80MM': return 'T80'
    case 'A4_CLASSIC':   return 'A4C'
    case 'A4_MODERN':    return 'A4M'
    case 'A5_COMPACT':   return 'A5'
    case 'A4_DETAILED':  return 'A4D'
    default:             return 'TPL'
  }
}

export const BaseTemplateCard: React.FC<BaseTemplateCardProps> = ({ baseTemplate, onSelect }) => {
  const { t } = useLanguage()
  const label = BASE_TEMPLATE_LABELS[baseTemplate]
  const description = BASE_TEMPLATE_DESCRIPTIONS[baseTemplate]
  const abbrev = getAbbrev(baseTemplate)

  return (
    <div className="template-card" aria-label={`Base template: ${label}`}>
      <div className="template-card-preview" aria-hidden="true">
        <span
          style={{
            fontSize: 'var(--fs-lg)',
            fontWeight: 700,
            color: 'var(--color-gray-300)',
            letterSpacing: '0.04em',
          }}
        >
          {abbrev}
        </span>
      </div>

      <div className="template-card-info">
        <div className="template-card-name" title={label}>
          {label}
        </div>
        <p
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-gray-500)',
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>

      <button
        className="template-card-use-btn"
        aria-label={`Use ${label} as base template`}
        onClick={() => onSelect(baseTemplate)}
      >
        {t.useThisTemplate}
      </button>
    </div>
  )
}
