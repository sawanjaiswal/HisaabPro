/** Layout tab — header + table layout controls */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'

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

export const LayoutTab: React.FC<LayoutTabProps> = ({ config, onChange }) => {
  const { t } = useLanguage()
  return (
  <>
    <Section title={t.headerSection}>
      <ControlRow label={t.logoPositionLabel}>
        <SegmentedControl<LogoPosition>
          value={config.layout.logoPosition}
          options={['left', 'center', 'right', 'none']}
          labels={LOGO_POSITION_LABELS}
          ariaLabel={t.logoPositionAria}
          onChange={(v) => onChange({ layout: { ...config.layout, logoPosition: v } })}
        />
      </ControlRow>
      <ControlRow label={t.headerStyleLabel}>
        <SegmentedControl<HeaderStyle>
          value={config.layout.headerStyle}
          options={['stacked', 'side-by-side', 'minimal']}
          labels={HEADER_STYLE_LABELS}
          ariaLabel={t.headerStyleAria}
          onChange={(v) => onChange({ layout: { ...config.layout, headerStyle: v } })}
        />
      </ControlRow>
    </Section>

    <Section title={t.tableLabel}>
      <ControlRow label={t.tableStyleLabel}>
        <SegmentedControl<ItemTableStyle>
          value={config.layout.itemTableStyle}
          options={['bordered', 'striped', 'minimal']}
          labels={TABLE_STYLE_LABELS}
          ariaLabel={t.tableStyleAria}
          onChange={(v) => onChange({ layout: { ...config.layout, itemTableStyle: v } })}
        />
      </ControlRow>
      <ControlRow label={t.summaryPositionLabel}>
        <SegmentedControl<SummaryPosition>
          value={config.layout.summaryPosition}
          options={['right', 'center', 'full-width']}
          labels={SUMMARY_POSITION_LABELS}
          ariaLabel={t.summaryPositionAria}
          onChange={(v) => onChange({ layout: { ...config.layout, summaryPosition: v } })}
        />
      </ControlRow>
    </Section>
  </>
  )
}
