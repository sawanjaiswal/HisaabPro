import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
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
      <div className="space-y-4">
        <Input
          id="template-header-text"
          label={t.headerTextLabel}
          type="text"
          value={config.headerText}
          maxLength={MAX_HEADER_TEXT_LENGTH}
          placeholder={t.headerTextPlaceholder}
          aria-label={t.headerTextAria}
          hint={`${config.headerText.length}/${MAX_HEADER_TEXT_LENGTH}`}
          onChange={(e) => onChange({ headerText: e.target.value })}
        />

        <Input
          id="template-footer-text"
          label={t.footerTextLabel}
          type="text"
          value={config.footerText}
          maxLength={MAX_FOOTER_TEXT_LENGTH}
          placeholder={t.footerTextPlaceholder}
          aria-label={t.footerTextAria}
          hint={`${config.footerText.length}/${MAX_FOOTER_TEXT_LENGTH}`}
          onChange={(e) => onChange({ footerText: e.target.value })}
        />

        <Textarea
          id="template-terms-text"
          label={t.defaultTermsConditions}
          value={config.termsText}
          maxLength={MAX_TERMS_TEXT_LENGTH}
          rows={4}
          showCount
          placeholder={t.enterDefaultTerms}
          aria-label={t.defaultTermsAria}
          onChange={(e) => onChange({ termsText: e.target.value })}
        />
      </div>
    </Section>
  )
}
