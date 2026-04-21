/** Invoice preview — line items table with configurable columns */

import React from 'react'
import type { TemplateColumnsConfig, TemplateLayoutConfig } from '../template.types'
import {
  SAMPLE_ITEMS,
  COL_RENDER,
  type SampleLineItem,
} from './templatePreview.constants'

interface PreviewLineItemsProps {
  visibleColumns: Array<{ key: keyof TemplateColumnsConfig; label: string }>
  layout: TemplateLayoutConfig
  cellStyle: React.CSSProperties
  thStyle: React.CSSProperties
}

export const PreviewLineItems: React.FC<PreviewLineItemsProps> = ({
  visibleColumns,
  layout,
  cellStyle,
  thStyle,
}) => (
  <div style={{ overflowX: 'auto' }} aria-hidden="true">
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 'var(--fs-sm)',
      }}
    >
      <thead>
        <tr>
          {visibleColumns.map(({ key, label }) => (
            <th key={key} style={thStyle}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SAMPLE_ITEMS.map((item: SampleLineItem, idx: number) => (
          <tr
            key={item.name}
            style={
              layout.itemTableStyle === 'striped' && idx % 2 === 1
                ? { backgroundColor: 'var(--color-gray-50)' }
                : undefined
            }
          >
            {visibleColumns.map(({ key }) => (
              <td key={key} style={cellStyle}>
                {(COL_RENDER[key] ?? (() => '—'))(item, idx)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
