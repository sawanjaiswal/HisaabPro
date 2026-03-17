/** Columns tab — toggle visibility of line item columns */

import React from 'react'

import type { TemplateConfig } from '../template.types'
import { COLUMN_ORDER } from '../template.constants'

import { ToggleRow } from './ToggleRow'
import { Section } from './Section'

/** Required columns that can never be hidden */
const LOCKED_COLUMNS = new Set<keyof TemplateConfig['columns']>(['itemName', 'quantity', 'rate', 'amount'])

interface ColumnsTabProps {
  config: TemplateConfig
  onChange: (patch: Partial<TemplateConfig>) => void
}

export const ColumnsTab: React.FC<ColumnsTabProps> = ({ config, onChange }) => (
  <Section title="Line Item Columns">
    {COLUMN_ORDER.map((key) => {
      const col = config.columns[key]
      const isLocked = LOCKED_COLUMNS.has(key)
      return (
        <ToggleRow
          key={key}
          label={col.label}
          sublabel={isLocked ? 'Required — cannot be hidden' : undefined}
          checked={col.visible}
          disabled={isLocked}
          ariaLabel={`${isLocked ? 'Required column' : 'Toggle column'}: ${col.label}`}
          onChange={(checked) =>
            onChange({
              columns: {
                ...config.columns,
                [key]: { ...col, visible: checked },
              },
            })
          }
        />
      )
    })}
  </Section>
)
