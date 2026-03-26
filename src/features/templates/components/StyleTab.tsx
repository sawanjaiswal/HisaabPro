/** Style tab — typography + accent colour controls */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'

import type {
  TemplateConfig,
  TemplateFontFamily,
  TemplateFontSize,
  TemplateLineHeight,
} from '../template.types'
import {
  FONT_FAMILY_LABELS,
  FONT_SIZE_LABELS,
  LINE_HEIGHT_LABELS,
  COLOR_PRESETS,
} from '../template.constants'

import { SegmentedControl } from './SegmentedControl'
import { ControlRow } from './ControlRow'
import { Section } from './Section'

interface StyleTabProps {
  config: TemplateConfig
  onChange: (patch: Partial<TemplateConfig>) => void
}

export const StyleTab: React.FC<StyleTabProps> = ({ config, onChange }) => {
  const { t } = useLanguage()
  const { typography, colors } = config

  return (
    <>
      <Section title={t.typographySection}>
        <ControlRow label={t.fontFamilyLabel}>
          <SegmentedControl<TemplateFontFamily>
            value={typography.fontFamily}
            options={['inter', 'noto-sans', 'roboto', 'poppins']}
            labels={FONT_FAMILY_LABELS}
            ariaLabel={t.fontFamilyAria}
            onChange={(v) => onChange({ typography: { ...typography, fontFamily: v } })}
          />
        </ControlRow>
        <ControlRow label={t.fontSizeLabel}>
          <SegmentedControl<TemplateFontSize>
            value={typography.fontSize}
            options={['xs', 'small', 'medium', 'large', 'xl']}
            labels={FONT_SIZE_LABELS}
            ariaLabel={t.fontSizeAria}
            onChange={(v) => onChange({ typography: { ...typography, fontSize: v } })}
          />
        </ControlRow>
        <ControlRow label={t.lineHeightLabel}>
          <SegmentedControl<TemplateLineHeight>
            value={typography.lineHeight}
            options={['compact', 'normal', 'relaxed']}
            labels={LINE_HEIGHT_LABELS}
            ariaLabel={t.lineHeightAria}
            onChange={(v) => onChange({ typography: { ...typography, lineHeight: v } })}
          />
        </ControlRow>
      </Section>

      <Section title={t.accentColourSection}>
        <div className="template-color-swatches" role="group" aria-label={t.accentColourAria}>
          {COLOR_PRESETS.map(({ name, hex }) => (
            <button
              key={hex}
              type="button"
              className={`template-color-swatch${colors.accent === hex ? ' active' : ''}`}
              aria-label={`${name} (${hex})`}
              aria-pressed={colors.accent === hex}
              style={{ backgroundColor: hex }}
              onClick={() =>
                onChange({
                  colors: {
                    ...colors,
                    accent: hex,
                    headerBg: hex,
                  },
                })
              }
            />
          ))}
        </div>
      </Section>
    </>
  )
}
