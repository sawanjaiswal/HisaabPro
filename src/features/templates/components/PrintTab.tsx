/** Print tab — page size, orientation, margins, copies, and print options */

import React from 'react'

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

export const PrintTab: React.FC<PrintTabProps> = ({ printSettings, onChange }) => (
  <>
    <Section title="Page">
      <ControlRow label="Page Size">
        <select
          className="input"
          value={printSettings.pageSize}
          aria-label="Page size"
          onChange={(e) => onChange({ pageSize: e.target.value as PageSize })}
          style={{ minHeight: 44 }}
        >
          {(Object.keys(PAGE_SIZE_LABELS) as PageSize[]).map((size) => (
            <option key={size} value={size}>{PAGE_SIZE_LABELS[size]}</option>
          ))}
        </select>
      </ControlRow>

      <ControlRow label="Orientation">
        <SegmentedControl<PageOrientation>
          value={printSettings.orientation}
          options={['portrait', 'landscape']}
          labels={ORIENTATION_LABELS}
          ariaLabel="Page orientation"
          onChange={(v) => onChange({ orientation: v })}
        />
      </ControlRow>

      <ControlRow label="Margins">
        <SegmentedControl<PageMargins>
          value={printSettings.margins}
          options={['normal', 'narrow', 'wide', 'none']}
          labels={MARGINS_LABELS}
          ariaLabel="Page margins"
          onChange={(v) => onChange({ margins: v })}
        />
      </ControlRow>
    </Section>

    <Section title="Print Options">
      <ControlRow label="Copies">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="template-segmented-btn"
            aria-label="Decrease copies"
            disabled={printSettings.copies <= 1}
            onClick={() => onChange({ copies: Math.max(1, printSettings.copies - 1) })}
            style={{ minWidth: 44, minHeight: 44, fontWeight: 700 }}
          >
            −
          </button>
          <span
            style={{ minWidth: 32, textAlign: 'center', fontWeight: 600, fontSize: '1rem' }}
            aria-live="polite"
            aria-label={`${printSettings.copies} copies`}
          >
            {printSettings.copies}
          </span>
          <button
            type="button"
            className="template-segmented-btn"
            aria-label="Increase copies"
            disabled={printSettings.copies >= MAX_COPIES}
            onClick={() => onChange({ copies: Math.min(MAX_COPIES, printSettings.copies + 1) })}
            style={{ minWidth: 44, minHeight: 44, fontWeight: 700 }}
          >
            +
          </button>
        </div>
      </ControlRow>

      <ToggleRow
        label="Header on All Pages"
        sublabel="Repeat business header on every page"
        checked={printSettings.headerOnAllPages}
        ariaLabel="Repeat header on all pages"
        onChange={(v) => onChange({ headerOnAllPages: v })}
      />
      <ToggleRow
        label="Page Numbers"
        checked={printSettings.pageNumbers}
        ariaLabel="Show page numbers"
        onChange={(v) => onChange({ pageNumbers: v })}
      />
    </Section>

    <Section title="Stamp & Labels">
      <ControlRow label="Payment Stamp">
        <SegmentedControl<StampStyle>
          value={printSettings.stampStyle}
          options={['badge', 'watermark', 'none']}
          labels={STAMP_STYLE_LABELS}
          ariaLabel="Payment stamp style"
          onChange={(v) => onChange({ stampStyle: v })}
        />
      </ControlRow>

      <ToggleRow
        label="Copy Labels"
        sublabel="ORIGINAL / DUPLICATE / TRIPLICATE"
        checked={printSettings.copyLabels}
        ariaLabel="Enable copy labels"
        onChange={(v) => onChange({ copyLabels: v })}
      />

      {printSettings.copyLabels && (
        <ControlRow label="Label Mode">
          <SegmentedControl<CopyLabelMode>
            value={printSettings.copyLabelMode}
            options={['auto', 'manual']}
            labels={COPY_LABEL_MODE_LABELS}
            ariaLabel="Copy label mode"
            onChange={(v) => onChange({ copyLabelMode: v })}
          />
        </ControlRow>
      )}
    </Section>
  </>
)
