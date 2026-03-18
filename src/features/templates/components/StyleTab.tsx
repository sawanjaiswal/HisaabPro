/** Style tab — typography + accent colour controls */

import React from 'react'

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
  const { typography, colors } = config

  return (
    <>
      <Section title="Typography">
        <ControlRow label="Font Family">
          <SegmentedControl<TemplateFontFamily>
            value={typography.fontFamily}
            options={['inter', 'noto-sans', 'roboto', 'poppins']}
            labels={FONT_FAMILY_LABELS}
            ariaLabel="Font family"
            onChange={(v) => onChange({ typography: { ...typography, fontFamily: v } })}
          />
        </ControlRow>
        <ControlRow label="Font Size">
          <SegmentedControl<TemplateFontSize>
            value={typography.fontSize}
            options={['xs', 'small', 'medium', 'large', 'xl']}
            labels={FONT_SIZE_LABELS}
            ariaLabel="Font size"
            onChange={(v) => onChange({ typography: { ...typography, fontSize: v } })}
          />
        </ControlRow>
        <ControlRow label="Line Height">
          <SegmentedControl<TemplateLineHeight>
            value={typography.lineHeight}
            options={['compact', 'normal', 'relaxed']}
            labels={LINE_HEIGHT_LABELS}
            ariaLabel="Line height"
            onChange={(v) => onChange({ typography: { ...typography, lineHeight: v } })}
          />
        </ControlRow>
      </Section>

      <Section title="Accent Colour">
        <div className="template-color-swatches" role="group" aria-label="Accent colour presets">
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
