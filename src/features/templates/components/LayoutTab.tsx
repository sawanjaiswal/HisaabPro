/** Layout tab — header + table layout controls */

import React from 'react'

import type {
  TemplateConfig,
  LogoPosition,
  HeaderStyle,
  ItemTableStyle,
  SummaryPosition,
} from '../template.types'
import {
  LOGO_POSITION_LABELS,
  HEADER_STYLE_LABELS,
  TABLE_STYLE_LABELS,
  SUMMARY_POSITION_LABELS,
} from '../template.constants'

import { SegmentedControl } from './SegmentedControl'
import { ControlRow } from './ControlRow'
import { Section } from './Section'

interface LayoutTabProps {
  config: TemplateConfig
  onChange: (patch: Partial<TemplateConfig>) => void
}

export const LayoutTab: React.FC<LayoutTabProps> = ({ config, onChange }) => (
  <>
    <Section title="Header">
      <ControlRow label="Logo Position">
        <SegmentedControl<LogoPosition>
          value={config.layout.logoPosition}
          options={['left', 'center', 'right', 'none']}
          labels={LOGO_POSITION_LABELS}
          ariaLabel="Logo position"
          onChange={(v) => onChange({ layout: { ...config.layout, logoPosition: v } })}
        />
      </ControlRow>
      <ControlRow label="Header Style">
        <SegmentedControl<HeaderStyle>
          value={config.layout.headerStyle}
          options={['stacked', 'side-by-side', 'minimal']}
          labels={HEADER_STYLE_LABELS}
          ariaLabel="Header style"
          onChange={(v) => onChange({ layout: { ...config.layout, headerStyle: v } })}
        />
      </ControlRow>
    </Section>

    <Section title="Table">
      <ControlRow label="Table Style">
        <SegmentedControl<ItemTableStyle>
          value={config.layout.itemTableStyle}
          options={['bordered', 'striped', 'minimal']}
          labels={TABLE_STYLE_LABELS}
          ariaLabel="Table style"
          onChange={(v) => onChange({ layout: { ...config.layout, itemTableStyle: v } })}
        />
      </ControlRow>
      <ControlRow label="Summary Position">
        <SegmentedControl<SummaryPosition>
          value={config.layout.summaryPosition}
          options={['right', 'center', 'full-width']}
          labels={SUMMARY_POSITION_LABELS}
          ariaLabel="Summary position"
          onChange={(v) => onChange({ layout: { ...config.layout, summaryPosition: v } })}
        />
      </ControlRow>
    </Section>
  </>
)
