/** Text tab — custom header, footer, and terms text */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'

import type { TemplateConfig } from '../template.types'
import {
  MAX_HEADER_TEXT_LENGTH,
  MAX_FOOTER_TEXT_LENGTH,
  MAX_TERMS_TEXT_LENGTH,
} from '../template.constants'

import { Section } from './Section'

interface TextTabProps {
  config: TemplateConfig
  onChange: (patch: Partial<TemplateConfig>) => void
}

export const TextTab: React.FC<TextTabProps> = ({ config, onChange }) => {
  const { t } = useLanguage()
  return (
  <Section title={t.customText}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <label
          htmlFor="template-header-text"
          style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-gray-700)', marginBottom: 'var(--space-2)' }}
        >
          {t.headerTextLabel}
        </label>
        <input
          id="template-header-text"
          type="text"
          className="input"
          value={config.headerText}
          maxLength={MAX_HEADER_TEXT_LENGTH}
          placeholder={t.headerTextPlaceholder}
          aria-label={t.headerTextAria}
          onChange={(e) => onChange({ headerText: e.target.value })}
        />
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-gray-400)', marginTop: '4px', display: 'block' }}>
          {config.headerText.length}/{MAX_HEADER_TEXT_LENGTH}
        </span>
      </div>

      <div>
        <label
          htmlFor="template-footer-text"
          style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-gray-700)', marginBottom: 'var(--space-2)' }}
        >
          {t.footerTextLabel}
        </label>
        <input
          id="template-footer-text"
          type="text"
          className="input"
          value={config.footerText}
          maxLength={MAX_FOOTER_TEXT_LENGTH}
          placeholder={t.footerTextPlaceholder}
          aria-label={t.footerTextAria}
          onChange={(e) => onChange({ footerText: e.target.value })}
        />
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-gray-400)', marginTop: '4px', display: 'block' }}>
          {config.footerText.length}/{MAX_FOOTER_TEXT_LENGTH}
        </span>
      </div>

      <div>
        <label
          htmlFor="template-terms-text"
          style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-gray-700)', marginBottom: 'var(--space-2)' }}
        >
          {t.defaultTermsConditions}
        </label>
        <textarea
          id="template-terms-text"
          className="input"
          value={config.termsText}
          maxLength={MAX_TERMS_TEXT_LENGTH}
          rows={4}
          placeholder={t.enterDefaultTerms}
          aria-label={t.defaultTermsAria}
          onChange={(e) => onChange({ termsText: e.target.value })}
          style={{ resize: 'vertical', minHeight: '96px' }}
        />
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-gray-400)', marginTop: '4px', display: 'block' }}>
          {config.termsText.length}/{MAX_TERMS_TEXT_LENGTH}
        </span>
      </div>
    </div>
  </Section>
  )
}
