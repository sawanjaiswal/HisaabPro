/** Text tab — custom header, footer, and terms text */

import React from 'react'

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

export const TextTab: React.FC<TextTabProps> = ({ config, onChange }) => (
  <Section title="Custom Text">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <label
          htmlFor="template-header-text"
          style={{ display: 'block', fontSize: '0.833rem', fontWeight: 500, color: 'var(--color-gray-700)', marginBottom: 'var(--space-2)' }}
        >
          Header Text
        </label>
        <input
          id="template-header-text"
          type="text"
          className="input"
          value={config.headerText}
          maxLength={MAX_HEADER_TEXT_LENGTH}
          placeholder="e.g. || Shree Ganeshay Namah ||"
          aria-label="Header text printed above the invoice title"
          onChange={(e) => onChange({ headerText: e.target.value })}
        />
        <span style={{ fontSize: '0.694rem', color: 'var(--color-gray-400)', marginTop: '4px', display: 'block' }}>
          {config.headerText.length}/{MAX_HEADER_TEXT_LENGTH}
        </span>
      </div>

      <div>
        <label
          htmlFor="template-footer-text"
          style={{ display: 'block', fontSize: '0.833rem', fontWeight: 500, color: 'var(--color-gray-700)', marginBottom: 'var(--space-2)' }}
        >
          Footer Text
        </label>
        <input
          id="template-footer-text"
          type="text"
          className="input"
          value={config.footerText}
          maxLength={MAX_FOOTER_TEXT_LENGTH}
          placeholder="e.g. Thank you for your business!"
          aria-label="Footer text printed at the bottom of the invoice"
          onChange={(e) => onChange({ footerText: e.target.value })}
        />
        <span style={{ fontSize: '0.694rem', color: 'var(--color-gray-400)', marginTop: '4px', display: 'block' }}>
          {config.footerText.length}/{MAX_FOOTER_TEXT_LENGTH}
        </span>
      </div>

      <div>
        <label
          htmlFor="template-terms-text"
          style={{ display: 'block', fontSize: '0.833rem', fontWeight: 500, color: 'var(--color-gray-700)', marginBottom: 'var(--space-2)' }}
        >
          Default Terms & Conditions
        </label>
        <textarea
          id="template-terms-text"
          className="input"
          value={config.termsText}
          maxLength={MAX_TERMS_TEXT_LENGTH}
          rows={4}
          placeholder="Enter default terms pre-filled on new invoices…"
          aria-label="Default terms and conditions pre-filled on new invoices"
          onChange={(e) => onChange({ termsText: e.target.value })}
          style={{ resize: 'vertical', minHeight: '96px' }}
        />
        <span style={{ fontSize: '0.694rem', color: 'var(--color-gray-400)', marginTop: '4px', display: 'block' }}>
          {config.termsText.length}/{MAX_TERMS_TEXT_LENGTH}
        </span>
      </div>
    </div>
  </Section>
)
