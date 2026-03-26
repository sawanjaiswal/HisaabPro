/** Print tab — page size, orientation, margins, copies, and print options */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'

import type {
  PrintSettings,
  PageSize,
  PageOrientation,
  PageMargins,
  StampStyle,
  CopyLabelMode,
} from '../template.types'
import {
  PAGE_SIZE_LABELS,
  ORIENTATION_LABELS,
  MARGINS_LABELS,
  STAMP_STYLE_LABELS,
  COPY_LABEL_MODE_LABELS,
  MAX_COPIES,
} from '../template.constants'

import { SegmentedControl } from './SegmentedControl'
import { ToggleRow } from './ToggleRow'
import { ControlRow } from './ControlRow'
import { Section } from './Section'

interface PrintTabProps {
  printSettings: PrintSettings
  onChange: (patch: Partial<PrintSettings>) => void
}

export const PrintTab: React.FC<PrintTabProps> = ({ printSettings, onChange }) => {
  const { t } = useLanguage()
  return (
  <>
    <Section title={t.pageSection}>
      <ControlRow label={t.pageSizeLabel}>
        <select
          className="input"
          value={printSettings.pageSize}
          aria-label={t.pageSizeAria}
          onChange={(e) => onChange({ pageSize: e.target.value as PageSize })}
          style={{ minHeight: 44 }}
        >
          {(Object.keys(PAGE_SIZE_LABELS) as PageSize[]).map((size) => (
            <option key={size} value={size}>{PAGE_SIZE_LABELS[size]}</option>
          ))}
        </select>
      </ControlRow>

      <ControlRow label={t.orientationLabel}>
        <SegmentedControl<PageOrientation>
          value={printSettings.orientation}
          options={['portrait', 'landscape']}
          labels={ORIENTATION_LABELS}
          ariaLabel={t.orientationAria}
          onChange={(v) => onChange({ orientation: v })}
        />
      </ControlRow>

      <ControlRow label={t.marginsLabel}>
        <SegmentedControl<PageMargins>
          value={printSettings.margins}
          options={['normal', 'narrow', 'wide', 'none']}
          labels={MARGINS_LABELS}
          ariaLabel={t.marginsAria}
          onChange={(v) => onChange({ margins: v })}
        />
      </ControlRow>
    </Section>

    <Section title={t.printOptionsSection}>
      <ControlRow label={t.copiesLabel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="template-segmented-btn"
            aria-label={t.decreaseCopies}
            disabled={printSettings.copies <= 1}
            onClick={() => onChange({ copies: Math.max(1, printSettings.copies - 1) })}
            style={{ minWidth: 44, minHeight: 44, fontWeight: 700 }}
          >
            −
          </button>
          <span
            style={{ minWidth: 32, textAlign: 'center', fontWeight: 600, fontSize: '1rem' }}
            aria-live="polite"
            aria-label={`${printSettings.copies} ${t.copiesCountAria}`}
          >
            {printSettings.copies}
          </span>
          <button
            type="button"
            className="template-segmented-btn"
            aria-label={t.increaseCopies}
            disabled={printSettings.copies >= MAX_COPIES}
            onClick={() => onChange({ copies: Math.min(MAX_COPIES, printSettings.copies + 1) })}
            style={{ minWidth: 44, minHeight: 44, fontWeight: 700 }}
          >
            +
          </button>
        </div>
      </ControlRow>

      <ToggleRow
        label={t.headerOnAllPages}
        sublabel={t.repeatHeaderDesc}
        checked={printSettings.headerOnAllPages}
        ariaLabel={t.repeatHeaderAria}
        onChange={(v) => onChange({ headerOnAllPages: v })}
      />
      <ToggleRow
        label={t.pageNumbersLabel}
        checked={printSettings.pageNumbers}
        ariaLabel={t.showPageNumbers}
        onChange={(v) => onChange({ pageNumbers: v })}
      />
    </Section>

    <Section title={t.stampAndLabels}>
      <ControlRow label={t.paymentStampLabel}>
        <SegmentedControl<StampStyle>
          value={printSettings.stampStyle}
          options={['badge', 'watermark', 'none']}
          labels={STAMP_STYLE_LABELS}
          ariaLabel={t.paymentStampAria}
          onChange={(v) => onChange({ stampStyle: v })}
        />
      </ControlRow>

      <ToggleRow
        label={t.copyLabelsLabel}
        sublabel={t.copyLabelsDesc}
        checked={printSettings.copyLabels}
        ariaLabel={t.enableCopyLabels}
        onChange={(v) => onChange({ copyLabels: v })}
      />

      {printSettings.copyLabels && (
        <ControlRow label={t.labelModeLabel}>
          <SegmentedControl<CopyLabelMode>
            value={printSettings.copyLabelMode}
            options={['auto', 'manual']}
            labels={COPY_LABEL_MODE_LABELS}
            ariaLabel={t.copyLabelModeAria}
            onChange={(v) => onChange({ copyLabelMode: v })}
          />
        </ControlRow>
      )}
    </Section>
  </>
  )
}
